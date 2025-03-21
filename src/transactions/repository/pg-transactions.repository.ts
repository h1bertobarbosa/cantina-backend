import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { Transaction } from '../entities/transaction.entity';
import { TransactionsRepository } from './transactions-repository.interface';
import { Inject } from '@nestjs/common';
import { PostgresService } from 'src/postgres/postgres.service';
export interface TransactionTable {
  id: string;
  account_id: string;
  client_id: string;
  product_id?: string;
  client_name: string;
  description: string;
  payment_method: string;
  amount: number;
  quantity: number;
  created_at: Date;
  updated_at: Date;
  payed_at: Date;
  purchased_at?: Date;
}
export default class PgTransactionsRepository
  implements TransactionsRepository
{
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}
  async save(transaction: Transaction): Promise<Transaction> {
    const [newTransaction] = await this.postgresService.query<TransactionTable>(
      `INSERT INTO transactions (id, account_id,client_id, product_id,client_name, description, payment_method,amount,quantity,payed_at) VALUES ($1, $2, $3, $4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        this.guidProvider.generate(),
        transaction.getAccountId(),
        transaction.getClientId(),
        transaction.getProductId(),
        transaction.getClientName(),
        transaction.getDescription(),
        transaction.getPaymentMethod(),
        transaction.getAmount(),
        transaction.getQuantity(),
        transaction.getPayedAt(),
      ],
    );
    return Transaction.getInstance(newTransaction);
  }
}
