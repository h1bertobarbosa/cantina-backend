import { Injectable, NotFoundException } from '@nestjs/common';

import { PostgresService } from 'src/postgres/postgres.service';
import OutputSaleDto from './dto/output-sale.dto';
import { TransactionTable } from 'src/transactions/repository/pg-transactions.repository';
import { QuerySaleDto } from './dto/query-sale.dto';
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
    orderBy,
    orderDir,
    perPage,
    page,
    payedAt,
  }: QuerySaleDto) {
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [
      `transactions JOIN billing_items ON transactions.id = billing_items.transaction_id WHERE transactions.account_id = $${queryParams.length}`,
    ];

    if (createdAt) {
      queryParts.push(
        `AND transactions.created_at >= $${queryParams.length + 1}`,
      );
      queryParams.push(createdAt);
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

    const finalQueryCount = queryParts.join(' ');
    const queryParamsCount = [...queryParams];
    queryParts.push(`ORDER BY $${queryParams.length + 1}`);
    queryParams.push(`${orderBy} ${orderDir.toUpperCase()}`);
    queryParts.push(`LIMIT $${queryParams.length + 1}`);
    queryParams.push(perPage);
    queryParts.push(`OFFSET $${queryParams.length + 1}`);
    queryParams.push((page - 1) * perPage);
    const finalQuery = queryParts.join(' ');
    const queryTransactions = `SELECT * FROM ${finalQuery}`;
    const countTransactions = `SELECT COUNT(*) FROM ${finalQueryCount}`;
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
      `SELECT * FROM transactions WHERE id = $1`,
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
    );
  }

  async remove({ id }: InputGetById) {
    await this.postgresService.query<TransactionTable>(
      'DELETE FROM billing_items WHERE id = $1',
      [id],
    );
    await this.postgresService.query<TransactionTable>(
      `DELETE FROM transactions t
USING billing_items b
WHERE t.id = b.transaction_id
AND b.id = $1;`,
      [id],
    );
  }
}
