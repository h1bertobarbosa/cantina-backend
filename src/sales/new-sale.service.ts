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
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { LOGGER } from '../logger/logger.const';
import { BillingLedgerService } from 'src/billings/billing-ledger.service';

interface CreateSaleInput extends CreateSaleDto {
  accountId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

@Injectable()
export class NewSaleService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionRepository: TransactionsRepository,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
    @Inject(LOGGER) private readonly logger: LoggerService,
    private readonly billingLedger: BillingLedgerService,
  ) {}

  async execute(input: CreateSaleInput): Promise<OutputSaleDto> {
    if (input.paymentMethod === 'TO_RECEIVE') {
      const billing = await this.billingLedger.addSale({
        accountId: input.accountId,
        clientId: input.clientId,
        items: input.items,
        buyDate: input.buyDate,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
      });
      const [transaction] = await this.postgresService.query<{
        id: string;
        client_name: string;
        description: string;
        created_at: Date;
        updated_at: Date;
        purchased_at: Date;
      }>(
        `SELECT t.*, bi.purchased_at FROM billing_items bi JOIN transactions t ON t.id = bi.transaction_id WHERE t.id = $1 AND t.account_id = $2`,
        [billing.saleTransactionId, input.accountId],
      );
      return new OutputSaleDto(
        transaction.id,
        transaction.client_name,
        transaction.description,
        'TO_RECEIVE',
        input.items.reduce(
          (sum, item) => sum + Math.round(item.price * item.quantity * 100),
          0,
        ) / 100,
        transaction.created_at,
        transaction.updated_at,
        undefined,
        transaction.purchased_at,
      );
    }
    const products = await Promise.all(
      input.items.map((item) =>
        this.getProduct(item.productId, input.accountId),
      ),
    );
    const clientName = await this.getClientName(
      input.clientId,
      input.accountId,
    );
    const purchasedAt = input.buyDate
      ? new Date(`${input.buyDate}T12:00:00Z`)
      : new Date();
    const transactions = input.items.map((item) => {
      const product = products.find((p) => p.getId() === item.productId);
      const quantity = Number(item.quantity);
      const price = item.price || product.getPrice();
      product.setPrice(price);
      return Transaction.getInstance({
        id: '',
        account_id: input.accountId,
        client_id: input.clientId,
        product_id: product.getId(),
        client_name: clientName,
        description: CreateTransactionDescription.execute(product, quantity),
        payment_method: input.paymentMethod,
        amount: price * quantity,
        quantity,
      });
    });
    const created = await Promise.all(
      transactions.map((transaction) =>
        this.transactionRepository.save(transaction),
      ),
    );
    const first = created[0];
    const output = new OutputSaleDto(
      first.getId(),
      first.getClientName(),
      first.getDescription(),
      first.getPaymentMethod(),
      created.reduce((sum, transaction) => sum + transaction.getAmount(), 0),
      first.getCreatedAt(),
      first.getUpdatedAt(),
      first.getPayedAt(),
      purchasedAt,
    );
    await this.logCreateSale(input, created, purchasedAt);
    return output;
  }
  private async getProduct(id: string, accountId: string) {
    const [product] = await this.postgresService.query<ProductTable>(
      'SELECT * FROM products WHERE id = $1',
      [id],
    );
    if (!product || product.account_id !== accountId)
      throw new NotFoundException('Product not found');
    return new Product(product);
  }
  private async getClientName(id: string, accountId: string): Promise<string> {
    const [client] = await this.postgresService.query<ClientTable>(
      'SELECT name,account_id FROM clients WHERE id = $1',
      [id],
    );
    if (!client || client.account_id !== accountId)
      throw new NotFoundException('Client not found');
    return client.name;
  }
  private async logCreateSale(
    input: CreateSaleInput,
    created: Transaction[],
    purchasedAt: Date,
  ) {
    try {
      await this.postgresService.query(
        'INSERT INTO logs (id, account_id, user_id, user_name, user_email, data, log_type, obs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          this.guidProvider.generate(),
          input.accountId,
          input.userId,
          input.userName,
          input.userEmail,
          JSON.stringify({
            transactions: created.map((transaction) => ({
              id: transaction.getId(),
              clientId: transaction.getClientId(),
              clientName: transaction.getClientName(),
              productId: transaction.getProductId(),
              description: transaction.getDescription(),
              paymentMethod: transaction.getPaymentMethod(),
              amount: transaction.getAmount(),
              quantity: transaction.getQuantity(),
              payedAt: transaction.getPayedAt(),
              createdAt: transaction.getCreatedAt(),
              updatedAt: transaction.getUpdatedAt(),
            })),
            billing: { action: 'none' },
            purchasedAt,
          }),
          'create_sale',
          null,
        ],
      );
    } catch (error) {
      this.logger.error(
        `Failed to insert create_sale log for user ${input.userId}`,
        error,
      );
    }
  }
}
