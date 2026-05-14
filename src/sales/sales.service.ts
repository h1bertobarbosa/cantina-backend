import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { BillingsTable } from 'src/billings/repository/ports/billint-table.interface';
import { PostgresService } from 'src/postgres/postgres.service';
import { Product } from 'src/products/entities/product.entity';
import { ProductTable } from 'src/products/products.service';
import OutputSaleDto from './dto/output-sale.dto';
import CreateTransactionDescription from 'src/transactions/domain-service/create-transaction-description.ds';
import { TransactionTable } from 'src/transactions/repository/pg-transactions.repository';
import { QuerySaleDto } from './dto/query-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
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
      `transactions WHERE account_id = $${queryParams.length}`,
    ];

    if (createdAt) {
      queryParts.push(`AND created_at >= $${queryParams.length + 1}`);
      queryParams.push(createdAt);
    }
    if (payedAt) {
      queryParts.push(`AND payed_at >= $${queryParams.length + 1}`);
      queryParams.push(payedAt);
    }
    if (clientId) {
      queryParts.push(`AND client_id = $${queryParams.length + 1}`);
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
      data: transactions.map((transaction) =>
        this.toOutputSaleDto(transaction),
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
    return this.toOutputSaleDto(transaction);
  }

  async update(updateSaleDto: UpdateSaleDto) {
    const transaction = await this.getTransaction(
      updateSaleDto.id,
      updateSaleDto.accountId,
    );
    const product = await this.getProduct(
      updateSaleDto.productId,
      updateSaleDto.accountId,
    );
    const quantity = Number(updateSaleDto.quantity);
    const amount = product.getPrice() * quantity;
    const billing = await this.getLinkedBilling(
      transaction.id,
      updateSaleDto.accountId,
    );

    if (billing?.payed_at) {
      throw new BadRequestException('Paid billing sales cannot be edited');
    }

    if (billing) {
      const nextBillingAmount =
        Number(billing.amount) + amount - Number(transaction.amount);

      if (nextBillingAmount < 0) {
        throw new BadRequestException(
          'Cannot reduce sale below the amount already paid',
        );
      }

      await this.postgresService.query(
        `UPDATE billings SET amount = $1, updated_at = $2 WHERE id = $3 AND account_id = $4`,
        [nextBillingAmount, new Date(), billing.id, updateSaleDto.accountId],
      );
    }

    const [updatedTransaction] =
      await this.postgresService.query<TransactionTable>(
        `UPDATE transactions
       SET product_id = $1,
           description = $2,
           amount = $3,
           quantity = $4,
           created_at = $5,
           updated_at = $6
       WHERE id = $7 AND account_id = $8
       RETURNING *`,
        [
          product.getId(),
          CreateTransactionDescription.execute(product, quantity),
          amount,
          quantity,
          this.parseSaleDate(updateSaleDto.saleDate, transaction.created_at),
          new Date(),
          updateSaleDto.id,
          updateSaleDto.accountId,
        ],
      );

    return this.toOutputSaleDto(updatedTransaction);
  }

  async remove({ id, accountId }: InputGetById) {
    await this.postgresService.query<TransactionTable>(
      `DELETE FROM transactions WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
  }

  private async getTransaction(id: string, accountId: string) {
    const [transaction] = await this.postgresService.query<TransactionTable>(
      `SELECT * FROM transactions WHERE id = $1`,
      [id],
    );
    if (!transaction || transaction.account_id !== accountId) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
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

  private async getLinkedBilling(transactionId: string, accountId: string) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT b.*
       FROM billings b
       JOIN billing_items bi ON bi.billing_id = b.id
       WHERE bi.transaction_id = $1 AND b.account_id = $2`,
      [transactionId, accountId],
    );

    return billing;
  }

  private parseSaleDate(saleDate?: string, fallbackDate?: Date) {
    if (!saleDate) {
      return fallbackDate || new Date();
    }

    const [year, month, day] = saleDate.split('-').map(Number);

    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  private toOutputSaleDto(transaction: TransactionTable) {
    return new OutputSaleDto(
      transaction.id,
      transaction.client_id,
      transaction.product_id || '',
      transaction.client_name,
      transaction.description,
      transaction.payment_method,
      Number(transaction.amount),
      Number(transaction.quantity),
      transaction.created_at,
      transaction.updated_at,
      transaction.payed_at,
    );
  }
}
