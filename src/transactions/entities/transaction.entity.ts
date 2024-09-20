import { TransactionTable } from '../repository/pg-transactions.repository';
import {
  TransactionPaymentMethod,
  TransactionPaymentMethodEnum,
} from '../value-objects/transaction-payment-method.vo';

export class Transaction {
  private constructor(
    private id: string,
    private accountId: string,
    private clientId: string,
    private clientName: string,
    private description: string,
    private paymentMethod: TransactionPaymentMethod,
    private amount: number,
    private payedAt?: Date,
  ) {
    if (
      this.paymentMethod.getValue() !== TransactionPaymentMethodEnum.TO_RECEIVE
    ) {
      this.payedAt = new Date();
    }
  }
  static getInstance(input: Partial<TransactionTable>): Transaction {
    return new Transaction(
      input.id || '',
      input.account_id,
      input.client_id,
      input.client_name,
      input.description,
      TransactionPaymentMethod.getInstance(input.payment_method),
      input.amount,
      input.payed_at,
    );
  }

  getId() {
    return this.id;
  }

  getAccountId() {
    return this.accountId;
  }

  getClientId() {
    return this.clientId;
  }
  getClientName() {
    return this.clientName;
  }

  getDescription() {
    return this.description;
  }

  getPaymentMethod() {
    return this.paymentMethod.getValue();
  }

  getAmount() {
    return this.amount;
  }

  getPayedAt() {
    return this.payedAt;
  }
}
