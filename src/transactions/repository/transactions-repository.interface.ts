import { Transaction } from '../entities/transaction.entity';

export interface TransactionsRepository {
  save(transaction: Transaction): Promise<Transaction>;
}
export const TRANSACTIONS_REPOSITORY = Symbol('TRANSACTIONS_REPOSITORY');
