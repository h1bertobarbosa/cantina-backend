import { Injectable } from '@nestjs/common';
import { PostgresService } from 'src/postgres/postgres.service';
import { QueryTotalSaleDto } from './dto/query-total-sale.dto';

interface DashboardSummary {
  totalReceivablePeriod: number;
  totalReceivedPeriod: number;
  totalReceivableAllTime: number;
  grossSalesPeriod: number;
  salesCountPeriod: number;
  clientsCount: number;
  productsCount: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly postgresService: PostgresService) {}
  async getTotalSales(filter: QueryTotalSaleDto): Promise<{ total: number }> {
    const { accountId, paymentMethod, startDate, endDate } = filter;
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [`WHERE account_id = $${queryParams.length}`];
    if (paymentMethod) {
      queryParts.push(`AND payment_method = $${queryParams.length + 1}`);
      queryParams.push(paymentMethod);
    }
    if (startDate) {
      queryParts.push(`AND created_at >= $${queryParams.length + 1}`);
      queryParams.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      queryParts.push(`AND created_at <= $${queryParams.length + 1}`);
      queryParams.push(`${endDate} 23:59:59`);
    }
    const finalQuery = queryParts.join(' ');
    const queryTotal = `SELECT sum(amount * quantity) as total FROM transactions ${finalQuery}`;
    const row = await this.postgresService.query<{ total: number }>(
      queryTotal,
      queryParams,
    );

    return {
      total: Number(row[0].total) ?? 0,
    };
  }

  async getSummary(filter: QueryTotalSaleDto): Promise<DashboardSummary> {
    const { accountId, startDate, endDate } = filter;
    const businessDateParams: (string | Date)[] = [accountId];
    const businessDateWhere = ['transactions.account_id = $1'];

    if (startDate) {
      businessDateWhere.push(
        `COALESCE(billing_items.purchased_at, transactions.created_at) >= $${
          businessDateParams.length + 1
        }`,
      );
      businessDateParams.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      businessDateWhere.push(
        `COALESCE(billing_items.purchased_at, transactions.created_at) <= $${
          businessDateParams.length + 1
        }`,
      );
      businessDateParams.push(`${endDate} 23:59:59`);
    }

    const receivedParams: (string | Date)[] = [accountId];
    const receivedWhere = ['transactions.account_id = $1'];

    if (startDate) {
      receivedWhere.push(
        `transactions.payed_at >= $${receivedParams.length + 1}`,
      );
      receivedParams.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      receivedWhere.push(
        `transactions.payed_at <= $${receivedParams.length + 1}`,
      );
      receivedParams.push(`${endDate} 23:59:59`);
    }

    const businessDateClause = businessDateWhere.join(' AND ');
    const receivedDateClause = receivedWhere.join(' AND ');

    const [
      receivablePeriodRow,
      receivableAllTimeRow,
      receivedPeriodRow,
      grossSalesPeriodRow,
      salesCountPeriodRow,
      clientsCountRow,
      productsCountRow,
    ] = await Promise.all([
      this.postgresService.query<{ total: number }>(
        `
          SELECT COALESCE(SUM(billings.amount), 0) AS total
          FROM billings
          WHERE billings.account_id = $1
            AND COALESCE(billings.amount, 0) > 0
            AND billings.status IN ('OPEN', 'PARTIAL')
            AND EXISTS (
              SELECT 1
              FROM billing_items
              JOIN transactions ON transactions.id = billing_items.transaction_id
              WHERE billing_items.billing_id = billings.id
                AND billing_items.type = 'DEBIT'
                AND ${businessDateClause}
            )
        `,
        businessDateParams,
      ),
      this.postgresService.query<{ total: number }>(
        `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM billings
          WHERE account_id = $1
            AND COALESCE(amount, 0) > 0
            AND status IN ('OPEN', 'PARTIAL')
        `,
        [accountId],
      ),
      this.postgresService.query<{ total: number }>(
        `
          SELECT COALESCE(SUM(transactions.amount), 0) AS total
          FROM transactions
          LEFT JOIN billing_items ON billing_items.transaction_id = transactions.id
          WHERE ${receivedDateClause}
            AND transactions.payed_at IS NOT NULL
            AND (
              billing_items.type = 'CREDIT'
              OR (
                transactions.product_id IS NOT NULL
                AND billing_items.id IS NULL
                AND transactions.payment_method <> 'TO_RECEIVE'
              )
            )
        `,
        receivedParams,
      ),
      this.postgresService.query<{ total: number }>(
        `
          SELECT COALESCE(SUM(transactions.amount), 0) AS total
          FROM transactions
          LEFT JOIN billing_items ON billing_items.transaction_id = transactions.id
          WHERE ${businessDateClause}
            AND transactions.product_id IS NOT NULL
            AND (
              billing_items.type = 'DEBIT'
              OR billing_items.id IS NULL
            )
        `,
        businessDateParams,
      ),
      this.postgresService.query<{ total: number }>(
        `
          SELECT COUNT(DISTINCT transactions.id) AS total
          FROM transactions
          LEFT JOIN billing_items ON billing_items.transaction_id = transactions.id
          WHERE ${businessDateClause}
            AND transactions.product_id IS NOT NULL
            AND (
              billing_items.type = 'DEBIT'
              OR billing_items.id IS NULL
            )
        `,
        businessDateParams,
      ),
      this.postgresService.query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM clients WHERE account_id = $1`,
        [accountId],
      ),
      this.postgresService.query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM products WHERE account_id = $1`,
        [accountId],
      ),
    ]);

    return {
      totalReceivablePeriod: Number(receivablePeriodRow[0]?.total || 0),
      totalReceivableAllTime: Number(receivableAllTimeRow[0]?.total || 0),
      totalReceivedPeriod: Number(receivedPeriodRow[0]?.total || 0),
      grossSalesPeriod: Number(grossSalesPeriodRow[0]?.total || 0),
      salesCountPeriod: Number(salesCountPeriodRow[0]?.total || 0),
      clientsCount: Number(clientsCountRow[0]?.total || 0),
      productsCount: Number(productsCountRow[0]?.total || 0),
    };
  }
}
