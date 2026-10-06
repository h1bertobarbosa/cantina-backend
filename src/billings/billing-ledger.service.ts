import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { LOGGER } from 'src/logger/logger.const';
import { PostgresService } from 'src/postgres/postgres.service';
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
}
