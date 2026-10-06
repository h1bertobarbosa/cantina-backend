import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { LOGGER } from 'src/logger/logger.const';
import { PostgresService } from 'src/postgres/postgres.service';
import { Product } from 'src/products/entities/product.entity';
import { ProductTable } from 'src/products/products.service';
import CreateTransactionDescription from 'src/transactions/domain-service/create-transaction-description.ds';
import { BillingsTable } from './repository/ports/billint-table.interface';

export interface ClientAccountInput {
  accountId: string;
  clientId: string;
}

export interface LedgerTotals {
  debitTotal: number;
  creditTotal: number;
  openAmount: number;
}

export interface CreateManagedBillingInput extends ClientAccountInput {
  description: string;
  amount?: number;
  purchaseDate?: string;
}

export interface AddBillingDebitInput {
  accountId: string;
  billingId: string;
  amount: number;
  description: string;
  purchaseDate?: string;
}

export interface AddBillingCreditInput {
  accountId: string;
  billingId: string;
  amount: number;
  paymentMethod: string;
  description?: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface AddBillingSaleInput {
  accountId: string;
  billingId?: string;
  clientId?: string;
  items: Array<{
    productId: string;
    price: number;
    quantity: number;
  }>;
  buyDate?: string;
  userId: string;
  userName: string;
  userEmail: string;
}

interface ClientRow {
  id: string;
  account_id: string;
  name: string;
}

@Injectable()
export class BillingLedgerService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
    @Inject(LOGGER) private readonly logger: LoggerService,
  ) {}

  async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.postgresService.getClient();

    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveBilling(
    { accountId, clientId }: ClientAccountInput,
    client: Pick<PoolClient, 'query'>,
  ): Promise<BillingsTable | null> {
    const result = await client.query<BillingsTable>(
      `
        SELECT *
        FROM billings
        WHERE account_id = $1
          AND client_id = $2
          AND status IN ('OPEN', 'PARTIAL')
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE
      `,
      [accountId, clientId],
    );

    return result.rows[0] || null;
  }

  async createBilling(
    input: CreateManagedBillingInput,
  ): Promise<BillingsTable> {
    return this.withTransaction(async (client) => {
      const aClient = await this.getClient(
        input.clientId,
        input.accountId,
        client,
      );
      const activeBilling = await this.getActiveBilling(input, client);

      if (activeBilling) {
        throw new ConflictException({
          message: 'Client already has an active billing.',
          activeBillingId: activeBilling.id,
        });
      }

      const billingId = this.generateId();
      const [billing] = await this.queryRows<BillingsTable>(
        client,
        `
          INSERT INTO billings (
            id,
            account_id,
            client_id,
            payment_method,
            description,
            amount,
            amount_payed,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          billingId,
          input.accountId,
          input.clientId,
          'TO_RECEIVE',
          input.description,
          0,
          0,
          'OPEN',
        ],
      );

      if (input.amount && Number(input.amount) > 0) {
        return this.addDebitToBilling(
          billing,
          aClient.name,
          {
            accountId: input.accountId,
            billingId,
            amount: input.amount,
            description: input.description,
            purchaseDate: input.purchaseDate,
          },
          client,
        );
      }

      return billing;
    });
  }

  async addDebit(input: AddBillingDebitInput): Promise<BillingsTable> {
    return this.withTransaction(async (client) => {
      const billing = await this.getBillingForUpdate(
        input.billingId,
        input.accountId,
        client,
      );
      const aClient = await this.getClient(
        billing.client_id,
        input.accountId,
        client,
      );

      return this.addDebitToBilling(billing, aClient.name, input, client);
    });
  }

  async addCredit(input: AddBillingCreditInput): Promise<BillingsTable> {
    if (!input.amount || Number(input.amount) <= 0) {
      throw new BadRequestException('Credit amount must be greater than zero');
    }

    return this.withTransaction(async (client) => {
      const billing = await this.getBillingForUpdate(
        input.billingId,
        input.accountId,
        client,
      );
      this.assertBillingIsMutable(billing);
      const aClient = await this.getClient(
        billing.client_id,
        input.accountId,
        client,
      );
      const transactionId = this.generateId();
      const description =
        input.description || `Crédito de R$ ${Number(input.amount).toFixed(2)}`;

      await client.query(
        `
          INSERT INTO transactions (
            id,
            account_id,
            client_id,
            client_name,
            description,
            payment_method,
            amount,
            quantity,
            payed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          transactionId,
          input.accountId,
          billing.client_id,
          aClient.name,
          description,
          input.paymentMethod,
          input.amount,
          1,
          new Date(),
        ],
      );

      await client.query(
        `
          INSERT INTO billing_items (
            id,
            billing_id,
            transaction_id,
            type,
            purchased_at
          ) VALUES ($1, $2, $3, $4, $5)
        `,
        [this.generateId(), billing.id, transactionId, 'CREDIT', new Date()],
      );

      const updatedBilling = await this.updateBillingProjection(
        billing.id,
        input.accountId,
        client,
      );
      await this.insertBillingLog(client, {
        accountId: input.accountId,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        logType: 'billing_credit',
        data: {
          billingId: billing.id,
          transactionId,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          before: {
            amount: Number(billing.amount),
            amountPayed: Number(billing.amount_payed),
            status: billing.status,
            payedAt: billing.payed_at,
          },
          after: {
            amount: Number(updatedBilling.amount),
            amountPayed: Number(updatedBilling.amount_payed),
            status: updatedBilling.status,
            payedAt: updatedBilling.payed_at,
          },
        },
      });

      return updatedBilling;
    });
  }

  async addSale(input: AddBillingSaleInput): Promise<BillingsTable> {
    if (!input.items?.length) {
      throw new BadRequestException('Sale must have at least one item');
    }

    input.items.forEach((item) => {
      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new BadRequestException('Sale item quantity must be greater than zero');
      }

      if (!item.price || Number(item.price) <= 0) {
        throw new BadRequestException('Sale item price must be greater than zero');
      }
    });

    return this.withTransaction(async (client) => {
      const { billing, clientName } = await this.resolveSaleBilling(
        input,
        client,
      );
      this.assertBillingIsMutable(billing);
      const transactionIds: string[] = [];

      for (const item of input.items) {
        const product = await this.getProduct(
          item.productId,
          input.accountId,
          client,
        );
        const quantity = Number(item.quantity);
        const price = Number(item.price);
        product.setPrice(price);
        const transactionId = this.generateId();
        transactionIds.push(transactionId);

        await client.query(
          `
            INSERT INTO transactions (
              id,
              account_id,
              client_id,
              product_id,
              client_name,
              description,
              payment_method,
              amount,
              quantity
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            transactionId,
            input.accountId,
            billing.client_id,
            product.getId(),
            clientName,
            CreateTransactionDescription.execute(product, quantity),
            'TO_RECEIVE',
            price * quantity,
            quantity,
          ],
        );

        await client.query(
          `
            INSERT INTO billing_items (
              id,
              billing_id,
              transaction_id,
              type,
              purchased_at
            ) VALUES ($1, $2, $3, $4, $5)
          `,
          [
            this.generateId(),
            billing.id,
            transactionId,
            'DEBIT',
            this.getPurchasedAt(input.buyDate),
          ],
        );
      }

      const updatedBilling = await this.updateBillingProjection(
        billing.id,
        input.accountId,
        client,
      );
      await this.insertBillingLog(client, {
        accountId: input.accountId,
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        logType: 'billing_sale',
        data: {
          billingId: billing.id,
          transactionIds,
          before: {
            amount: Number(billing.amount),
            amountPayed: Number(billing.amount_payed),
            status: billing.status,
          },
          after: {
            amount: Number(updatedBilling.amount),
            amountPayed: Number(updatedBilling.amount_payed),
            status: updatedBilling.status,
          },
        },
      });

      return updatedBilling;
    });
  }

  async calculateLedgerTotals(
    billingId: string,
    accountId: string,
    client: Pick<PoolClient, 'query'>,
  ): Promise<LedgerTotals> {
    const result = await client.query<{
      debit_total: string;
      credit_total: string;
    }>(
      `
        SELECT
          COALESCE(SUM(CASE WHEN billing_items.type = 'DEBIT' THEN transactions.amount ELSE 0 END), 0) AS debit_total,
          COALESCE(SUM(CASE WHEN billing_items.type = 'CREDIT' THEN transactions.amount ELSE 0 END), 0) AS credit_total
        FROM billing_items
        JOIN transactions ON transactions.id = billing_items.transaction_id
        WHERE billing_items.billing_id = $1
          AND transactions.account_id = $2
          AND NOT EXISTS (
            SELECT 1
            FROM billing_items reversals
            WHERE reversals.reversal_of_item_id = billing_items.id
          )
      `,
      [billingId, accountId],
    );
    const debitTotal = Number(result.rows[0]?.debit_total || 0);
    const creditTotal = Number(result.rows[0]?.credit_total || 0);

    return {
      debitTotal,
      creditTotal,
      openAmount: debitTotal - creditTotal,
    };
  }

  protected generateId(): string {
    return this.guidProvider.generate();
  }

  protected log(message: string) {
    this.logger.log(message);
  }

  private async addDebitToBilling(
    billing: BillingsTable,
    clientName: string,
    input: AddBillingDebitInput,
    client: PoolClient,
  ): Promise<BillingsTable> {
    this.assertBillingIsMutable(billing);

    const transactionId = this.generateId();
    await client.query(
      `
        INSERT INTO transactions (
          id,
          account_id,
          client_id,
          client_name,
          description,
          payment_method,
          amount,
          quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        transactionId,
        input.accountId,
        billing.client_id,
        clientName,
        input.description,
        'TO_RECEIVE',
        input.amount,
        1,
      ],
    );

    await client.query(
      `
        INSERT INTO billing_items (
          id,
          billing_id,
          transaction_id,
          type,
          purchased_at
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [
        this.generateId(),
        billing.id,
        transactionId,
        'DEBIT',
        this.getPurchasedAt(input.purchaseDate),
      ],
    );

    return this.updateBillingProjection(billing.id, input.accountId, client);
  }

  private async resolveSaleBilling(
    input: AddBillingSaleInput,
    client: PoolClient,
  ): Promise<{ billing: BillingsTable; clientName: string }> {
    if (input.billingId) {
      const billing = await this.getBillingForUpdate(
        input.billingId,
        input.accountId,
        client,
      );
      const aClient = await this.getClient(
        billing.client_id,
        input.accountId,
        client,
      );

      return { billing, clientName: aClient.name };
    }

    if (!input.clientId) {
      throw new BadRequestException('Client is required for sale billing');
    }

    const aClient = await this.getClient(input.clientId, input.accountId, client);
    const activeBilling = await this.getActiveBilling(
      { accountId: input.accountId, clientId: input.clientId },
      client,
    );

    if (activeBilling) {
      return { billing: activeBilling, clientName: aClient.name };
    }

    const billing = await this.createEmptyBilling(
      {
        accountId: input.accountId,
        clientId: input.clientId,
        description: `Fatura mes: ${new Date().getMonth()}/${new Date().getFullYear()}`,
      },
      client,
    );

    return { billing, clientName: aClient.name };
  }

  private async createEmptyBilling(
    input: ClientAccountInput & { description: string },
    client: Pick<PoolClient, 'query'>,
  ): Promise<BillingsTable> {
    const [billing] = await this.queryRows<BillingsTable>(
      client,
      `
        INSERT INTO billings (
          id,
          account_id,
          client_id,
          payment_method,
          description,
          amount,
          amount_payed,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        this.generateId(),
        input.accountId,
        input.clientId,
        'TO_RECEIVE',
        input.description,
        0,
        0,
        'OPEN',
      ],
    );

    return billing;
  }

  private async getBillingForUpdate(
    billingId: string,
    accountId: string,
    client: Pick<PoolClient, 'query'>,
  ): Promise<BillingsTable> {
    const [billing] = await this.queryRows<BillingsTable>(
      client,
      `
        SELECT *
        FROM billings
        WHERE id = $1
        FOR UPDATE
      `,
      [billingId],
    );

    if (!billing || billing.account_id !== accountId) {
      throw new NotFoundException('Billing not found');
    }

    return billing;
  }

  private async getClient(
    clientId: string,
    accountId: string,
    client: Pick<PoolClient, 'query'>,
  ): Promise<ClientRow> {
    const [aClient] = await this.queryRows<ClientRow>(
      client,
      `
        SELECT id, account_id, name
        FROM clients
        WHERE id = $1
      `,
      [clientId],
    );

    if (!aClient || aClient.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }

    return aClient;
  }

  private async getProduct(
    productId: string,
    accountId: string,
    client: Pick<PoolClient, 'query'>,
  ): Promise<Product> {
    const [product] = await this.queryRows<ProductTable>(
      client,
      `
        SELECT *
        FROM products
        WHERE id = $1
      `,
      [productId],
    );

    if (!product || product.account_id !== accountId) {
      throw new NotFoundException('Product not found');
    }

    return new Product(product);
  }

  private async updateBillingProjection(
    billingId: string,
    accountId: string,
    client: PoolClient,
  ): Promise<BillingsTable> {
    const totals = await this.calculateLedgerTotals(billingId, accountId, client);
    const status = this.getStatusFromTotals(totals);
    const openAmount = Math.max(totals.openAmount, 0);
    const payedAt = ['PAID', 'CREDIT_BALANCE'].includes(status)
      ? new Date()
      : null;
    const [billing] = await this.queryRows<BillingsTable>(
      client,
      `
        UPDATE billings
        SET
          amount = $1,
          amount_payed = $2,
          status = $3,
          payed_at = $4,
          updated_at = $5
        WHERE id = $6
          AND account_id = $7
        RETURNING *
      `,
      [
        openAmount,
        totals.creditTotal,
        status,
        payedAt,
        new Date(),
        billingId,
        accountId,
      ],
    );

    return billing;
  }

  private getStatusFromTotals(totals: LedgerTotals) {
    if (totals.openAmount < 0) {
      return 'CREDIT_BALANCE';
    }

    if (totals.openAmount === 0 && totals.creditTotal > 0) {
      return 'PAID';
    }

    if (totals.creditTotal > 0) {
      return 'PARTIAL';
    }

    return 'OPEN';
  }

  private assertBillingIsMutable(billing: BillingsTable) {
    if (!['OPEN', 'PARTIAL'].includes(billing.status)) {
      throw new BadRequestException('Billing is not open or partial');
    }
  }

  private getPurchasedAt(value?: string) {
    if (!value) {
      return new Date();
    }

    return new Date(`${value.split('T')[0]}T12:00:00Z`);
  }

  private async queryRows<T>(
    client: Pick<PoolClient, 'query'>,
    sql: string,
    params: unknown[],
  ): Promise<T[]> {
    const result = await client.query<T>(sql, params);
    return result.rows;
  }

  private async insertBillingLog(
    client: Pick<PoolClient, 'query'>,
    input: {
      accountId: string;
      userId: string;
      userName: string;
      userEmail: string;
      logType: string;
      data: unknown;
    },
  ) {
    await client.query(
      `
        INSERT INTO logs (
          id,
          account_id,
          user_id,
          user_name,
          user_email,
          data,
          log_type,
          obs
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        this.generateId(),
        input.accountId,
        input.userId,
        input.userName,
        input.userEmail,
        JSON.stringify(input.data),
        input.logType,
        null,
      ],
    );
  }
}
