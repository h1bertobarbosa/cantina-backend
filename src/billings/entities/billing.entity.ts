import { Transaction } from 'src/transactions/entities/transaction.entity';
import { BillingsTable } from '../repository/ports/billint-table.interface';
import { TransactionPaymentMethodEnum } from 'src/transactions/value-objects/transaction-payment-method.vo';

export default class Billing {
  private transactions: Transaction[] = [];
  private clientName: string;
  constructor(
    private id: string,
    private accountId: string,
    private clientId: string,
    private description: string,
    private amount: number,
    private paymentMethod: string,
    private payedAt?: Date,
    private createdAt?: Date,
    private updatedAt?: Date,
  ) {}

  static fromTable(input: BillingsTable): Billing {
    return new Billing(
      input.id,
      input.account_id,
      input.client_id,
      input.description,
      Number(input.amount),
      input.payment_method,
      input.payed_at,
      input.created_at,
      input.updated_at,
    );
  }

  pay(amount: number) {
    this.amount -= amount;
    if (amount < this.amount) {
      this.setTransaction(
        Transaction.fromData({
          accountId: this.accountId,
          clientId: this.clientId,
          clientName: '',
          description: 'Credito no valor de ' + amount,
          paymentMethod: TransactionPaymentMethodEnum[this.paymentMethod],
          amount,
        }),
      );
      return;
    }
    if (amount >= this.amount) {
      this.payedAt = new Date();
      this.setTransaction(
        Transaction.fromData({
          accountId: this.accountId,
          clientId: this.clientId,
          clientName: this.clientName,
          description: 'Credito no valor de ' + amount,
          paymentMethod: TransactionPaymentMethodEnum[this.paymentMethod],
          amount,
        }),
      );
    }
  }

  setClienteName(name: string) {
    this.clientName = name;
  }

  setTransaction(aTransaction: Transaction) {
    this.transactions.push(aTransaction);
  }

  getPayedAt() {
    return this.payedAt;
  }

  getId() {
    return this.id;
  }

  getAmount() {
    return this.amount;
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
}
