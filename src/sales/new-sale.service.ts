import {
  Inject,
  Injectable,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';

import { Transaction } from 'src/transactions/entities/transaction.entity';
import { PostgresService } from 'src/postgres/postgres.service';
import { ProductTable } from 'src/products/products.service';
import { Product } from 'src/products/entities/product.entity';
import CreateTransactionDescription from 'src/transactions/domain-service/create-transaction-description.ds';
import {
  TRANSACTIONS_REPOSITORY,
  TransactionsRepository,
} from 'src/transactions/repository/transactions-repository.interface';
import { ClientTable } from 'src/clients/clients.service';
import OutputSaleDto from './dto/output-sale.dto';
import {
  BillingItemsTable,
  BillingsTable,
} from 'src/billings/repository/ports/billint-table.interface';
import { BillingItemTypeEnum } from 'src/billings/entities/billing-item-type.vo';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { LOGGER } from '../logger/logger.const';

@Injectable()
export class NewSaleService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionRepository: TransactionsRepository,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
    @Inject(LOGGER) private readonly logger: LoggerService,
  ) {}
  async execute(createSaleDto: CreateSaleDto): Promise<OutputSaleDto> {
    const products = await Promise.all(
      createSaleDto.items.map((item) =>
        this.getProduct(item.productId, createSaleDto.accountId),
      ),
    );
    const clientName = await this.getClientName(
      createSaleDto.clientId,
      createSaleDto.accountId,
    );

    const purchasedAt = createSaleDto.buyDate
      ? new Date(`${createSaleDto.buyDate}T12:00:00Z`)
      : new Date();

    const transactions = [];
    for (const item of createSaleDto.items) {
      const product = products.find((p) => p.getId() === item.productId);
      const quantity = Number(item.quantity);
      const price = item.price || product.getPrice();
      product.setPrice(price);
      transactions.push(
        Transaction.getInstance({
          id: '',
          account_id: createSaleDto.accountId,
          client_id: createSaleDto.clientId,
          product_id: product.getId(),
          client_name: clientName,
          description: CreateTransactionDescription.execute(product, quantity),
          payment_method: createSaleDto.paymentMethod,
          amount: price * quantity,
          quantity: quantity,
        }),
      );
    }

    const createdTransactions = await Promise.all(
      transactions.map((transaction) =>
        this.transactionRepository.save(transaction),
      ),
    );
    this.logger.log(
      `Created transactions: ${JSON.stringify(
        createdTransactions.map((transaction) => transaction.getId()),
      )}`,
    );

    if (createSaleDto.paymentMethod === 'TO_RECEIVE') {
      const aBilling = await this.hasClientOpenBilling(
        createSaleDto.clientId,
        createSaleDto.accountId,
      );

      if (aBilling) {
        this.logger.log(
          `Client ${createSaleDto.clientId} has open billing: ${aBilling.id}`,
        );
        let newAmount = 0;
        for (const aTransaction of createdTransactions) {
          const amount = aTransaction.getAmount() + parseFloat(aBilling.amount);
          await this.postgresService.query(
            'INSERT INTO billing_items (id, billing_id, transaction_id, type, purchased_at) VALUES ($1, $2, $3, $4, $5)',
            [
              this.guidProvider.generate(),
              aBilling.id,
              aTransaction.getId(),
              BillingItemTypeEnum.DEBIT,
              purchasedAt.toISOString(),
            ],
          );
          newAmount = amount;
          if (Number(aBilling.amount_payed) > 0 && !Number(aBilling.amount)) {
            newAmount = Math.abs(amount - Number(aBilling.amount_payed));
            this.logger.log(
              `New amount: ${newAmount} - Amount payed: ${aBilling.amount_payed}`,
            );
          }
        }

        await this.postgresService.query(
          'UPDATE billings SET amount =  $1, updated_at = $2, amount_payed = $3 WHERE id = $4',
          [newAmount, new Date(), 0, aBilling.id],
        );
        this.logger.log(
          `Updated billing ${aBilling.id} with amount: ${newAmount}`,
        );
      } else {
        let amountBilling = 0;
        createdTransactions.forEach((aTransaction) => {
          amountBilling += aTransaction.getAmount();
        });
        const [newBilling] =
          await this.postgresService.query<BillingItemsTable>(
            'INSERT INTO billings (id, client_id, account_id,description,amount,payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [
              this.guidProvider.generate(),
              createSaleDto.clientId,
              createSaleDto.accountId,
              `Fatura mes: ${new Date().getMonth()}/${new Date().getFullYear()}`,
              amountBilling,
              createSaleDto.paymentMethod,
            ],
          );
        this.logger.log(
          `Created new billing ${newBilling.id} for client ${createSaleDto.clientId}`,
        );
        for (const aTransaction of createdTransactions) {
          await this.postgresService.query(
            'INSERT INTO billing_items (id, billing_id, transaction_id, type, purchased_at) VALUES ($1, $2, $3, $4, $5)',
            [
              this.guidProvider.generate(),
              newBilling.id,
              aTransaction.getId(),
              BillingItemTypeEnum.DEBIT,
              purchasedAt.toISOString(),
            ],
          );
          this.logger.log(
            `Created billing item ${aTransaction.getId()} for billing ${newBilling.id}`,
          );
        }
      }
    }

    const totalTransactionsAmount = createdTransactions.reduce(
      (acc, aTransaction) => {
        acc += aTransaction.getAmount();
        return acc;
      },
      0,
    );

    return new OutputSaleDto(
      createdTransactions[0].getId(),
      createdTransactions[0].getClientName(),
      createdTransactions[0].getDescription(),
      createdTransactions[0].getPaymentMethod(),
      totalTransactionsAmount,
      createdTransactions[0].getCreatedAt(),
      createdTransactions[0].getUpdatedAt(),
      createdTransactions[0].getPayedAt(),
      purchasedAt,
    );
  }

  private async hasClientOpenBilling(clientId: string, accountId: string) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT id,account_id,amount,amount_payed FROM billings WHERE client_id = $1 AND payed_at IS NULL`,
      [clientId],
    );
    if (!billing || billing.account_id !== accountId) {
      return false;
    }
    return billing;
  }

  private async getProduct(id: string, accountId: string) {
    const [product] = await this.postgresService.query<ProductTable>(
      `SELECT * FROM products WHERE id = $1`,
      [id],
    );
    if (!product || product.account_id !== accountId) {
      throw new NotFoundException('Product not found');
    }
    return new Product(product);
  }

  private async getClientName(id: string, accountId: string): Promise<string> {
    const [client] = await this.postgresService.query<ClientTable>(
      `SELECT name,account_id FROM clients WHERE id = $1`,
      [id],
    );
    if (!client || client.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }
    return client.name;
  }
}
