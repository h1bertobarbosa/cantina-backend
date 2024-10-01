import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class NewSaleService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionRepository: TransactionsRepository,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}
  async execute(createSaleDto: CreateSaleDto): Promise<OutputSaleDto> {
    const [product, clientName] = await Promise.all([
      this.getProduct(createSaleDto.productId, createSaleDto.accountId),
      this.getClientName(createSaleDto.clientId, createSaleDto.accountId),
    ]);
    const aTransaction = Transaction.getInstance({
      id: '',
      account_id: createSaleDto.accountId,
      client_id: createSaleDto.clientId,
      client_name: clientName,
      description: CreateTransactionDescription.execute(
        product,
        createSaleDto.quantity,
      ),
      payment_method: createSaleDto.paymentMethod,
      amount: product.getPrice() * createSaleDto.quantity,
    });

    const createdTransaction =
      await this.transactionRepository.save(aTransaction);

    if (aTransaction.getPaymentMethod() === 'TO_RECEIVE') {
      const aBilling = await this.hasClientOpenBilling(
        createSaleDto.clientId,
        createSaleDto.accountId,
      );

      if (aBilling) {
        const amount = aTransaction.getAmount() + parseFloat(aBilling.amount);
        await this.postgresService.query(
          'INSERT INTO billing_items (id, billing_id, transaction_id, type) VALUES ($1, $2, $3, $4)',
          [
            this.guidProvider.generate(),
            aBilling.id,
            createdTransaction.getId(),
            BillingItemTypeEnum.DEBIT,
          ],
        );
        await this.postgresService.query(
          'UPDATE billings SET amount = $1, updated_at = $2 WHERE id = $3',
          [amount, new Date(), aBilling.id],
        );
      } else {
        const [newBilling] =
          await this.postgresService.query<BillingItemsTable>(
            'INSERT INTO billings (id, client_id, account_id,description,amount,payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [
              this.guidProvider.generate(),
              createSaleDto.clientId,
              createSaleDto.accountId,
              `Fatura mes: ${new Date().getMonth()}/${new Date().getFullYear()}`,
              aTransaction.getAmount(),
              aTransaction.getPaymentMethod(),
            ],
          );
        await this.postgresService.query(
          'INSERT INTO billing_items (id, billing_id, transaction_id, type) VALUES ($1, $2, $3, $4)',
          [
            this.guidProvider.generate(),
            newBilling.id,
            createdTransaction.getId(),
            BillingItemTypeEnum.DEBIT,
          ],
        );
      }
    }
    return new OutputSaleDto(
      createdTransaction.getId(),
      createdTransaction.getClientName(),
      createdTransaction.getDescription(),
      createdTransaction.getPaymentMethod(),
      createdTransaction.getAmount(),
      createdTransaction.getCreatedAt(),
      createdTransaction.getUpdatedAt(),
      createdTransaction.getPayedAt(),
    );
  }

  private async hasClientOpenBilling(clientId: string, accountId: string) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT id,account_id,amount FROM billings WHERE client_id = $1 AND payed_at IS NULL`,
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
