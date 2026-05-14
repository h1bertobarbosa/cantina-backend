import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PostgresService } from 'src/postgres/postgres.service';
import OutputSaleDto from './dto/output-sale.dto';
import { TransactionTable } from 'src/transactions/repository/pg-transactions.repository';
import { QuerySaleDto } from './dto/query-sale.dto';
import {
  BillingItemsTable,
  BillingsTable,
} from '../billings/repository/ports/billint-table.interface';

const SALES_ORDER_BY_COLUMNS: Record<string, string> = {
  client_name: 'transactions.client_name',
  description: 'transactions.description',
  payment_method: 'transactions.payment_method',
  amount: 'transactions.amount',
  created_at: 'transactions.created_at',
  purchased_at: 'COALESCE(billing_items.purchased_at, transactions.created_at)',
};

export interface InputGetById {
  id: string;
  accountId: string;
}
@Injectable()
export class SalesService {
  constructor(private readonly postgresService: PostgresService) {}

  async findAll({
    accountId,
    clientId,
    createdAt,
    purchasedAt,
    orderBy,
    orderDir,
    perPage,
    page,
    payedAt,
    search,
  }: QuerySaleDto) {
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [
      `transactions LEFT JOIN billing_items ON transactions.id = billing_items.transaction_id WHERE transactions.account_id = $${queryParams.length}`,
    ];

    if (createdAt) {
      queryParts.push(
        `AND transactions.created_at >= $${queryParams.length + 1}`,
      );
      queryParams.push(createdAt);
    }
    if (purchasedAt) {
      queryParts.push(
        `AND billing_items.purchased_at >= $${queryParams.length + 1}`,
      );
      queryParams.push(purchasedAt);
    }
    if (payedAt) {
      queryParts.push(
        `AND transactions.payed_at >= $${queryParams.length + 1}`,
      );
      queryParams.push(payedAt);
    }
    if (clientId) {
      queryParts.push(
        `AND transactions.client_id = $${queryParams.length + 1}`,
      );
      queryParams.push(clientId);
    }
    if (search) {
      queryParts.push(
        `AND (transactions.client_name ILIKE $${queryParams.length + 1} OR transactions.description ILIKE $${queryParams.length + 1})`,
      );
      queryParams.push(`%${search}%`);
    }

    const finalQueryCount = queryParts.join(' ');
    const queryParamsCount = [...queryParams];
    const safeOrderBy =
      SALES_ORDER_BY_COLUMNS[orderBy || 'created_at'] ||
      SALES_ORDER_BY_COLUMNS.created_at;
    const safeOrderDir = orderDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    queryParts.push(`ORDER BY ${safeOrderBy} ${safeOrderDir}`);
    queryParts.push(`LIMIT ${perPage}`);
    queryParts.push(`OFFSET ${(page - 1) * perPage}`);
    const finalQuery = queryParts.join(' ');
    const queryTransactions = `SELECT transactions.*, billing_items.purchased_at FROM ${finalQuery}`;
    const countTransactions = `SELECT COUNT(DISTINCT transactions.id) FROM ${finalQueryCount}`;
    const [transactions, row] = await Promise.all([
      this.postgresService.query<TransactionTable>(
        queryTransactions,
        queryParams,
      ),
      this.postgresService.query<TransactionTable>(
        countTransactions,
        queryParamsCount,
      ),
    ]);
    return {
      data: transactions.map(
        (transaction) =>
          new OutputSaleDto(
            transaction.id,
            transaction.client_name,
            transaction.description,
            transaction.payment_method,
            transaction.amount,
            transaction.created_at,
            transaction.updated_at,
            transaction.payed_at,
            transaction.purchased_at,
          ),
      ),
      meta: {
        page,
        perPage,
        total: parseInt(row[0]['count']),
      },
    };
  }

  async findOne({ id, accountId }: InputGetById) {
    const [transaction] = await this.postgresService.query<TransactionTable>(
      `SELECT transactions.*, billing_items.purchased_at
       FROM transactions
       LEFT JOIN billing_items ON transactions.id = billing_items.transaction_id
       WHERE transactions.id = $1`,
      [id],
    );
    if (!transaction || transaction.account_id !== accountId) {
      throw new NotFoundException('Transaction not found');
    }
    return new OutputSaleDto(
      transaction.id,
      transaction.client_name,
      transaction.description,
      transaction.payment_method,
      transaction.amount,
      transaction.created_at,
      transaction.updated_at,
      transaction.payed_at,
      transaction.purchased_at,
    );
  }

  async remove({ id, accountId }: InputGetById) {
    const [transaction] = await this.postgresService.query<TransactionTable>(
      `SELECT * FROM transactions WHERE id = $1`,
      [id],
    );

    if (!transaction || transaction.account_id !== accountId) {
      throw new NotFoundException('Transaction not found');
    }

    const [billingItem] = await this.postgresService.query<BillingItemsTable>(
      `SELECT * FROM billing_items WHERE transaction_id = $1`,
      [id],
    );

    Logger.log(`Deleting transaction ${id}`);

    if (!billingItem) {
      await this.postgresService.query<TransactionTable>(
        'DELETE FROM transactions WHERE id = $1',
        [id],
      );
      return;
    }

    Logger.log(`Deleting billing item ${billingItem.id}`);
    await this.postgresService.query<TransactionTable>(
      'DELETE FROM billing_items WHERE transaction_id = $1',
      [id],
    );
    await this.postgresService.query<TransactionTable>(
      'DELETE FROM transactions WHERE id = $1',
      [id],
    );

    const billingId = billingItem.billing_id;
    const transactions = await this.postgresService.query<TransactionTable>(
      `SELECT t.* FROM transactions t 
      JOIN  billing_items b ON t.id = b.transaction_id
      WHERE b.billing_id = $1`,
      [billingId],
    );
    const billingTotal = transactions.reduce((acc, transaction) => {
      acc += Number(transaction.amount);
      return acc;
    }, 0);

    await this.postgresService.query<BillingsTable>(
      `UPDATE billings SET amount = $1 WHERE id = $2`,
      [billingTotal, billingId],
    );
    Logger.log(`Updated billing ${billingId} with new total ${billingTotal}`);
  }
}
