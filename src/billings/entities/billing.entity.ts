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
    private amountPayed: number,
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
      Number(input.amount_payed),
      input.payment_method,
      input.payed_at,
      input.created_at,
      input.updated_at,
    );
  }

  pay(amountPayed: number, paymentMethod: string) {
    this.amountPayed = amountPayed;
    const amountDifference = this.amount - this.amountPayed;
    if (amountDifference > 0) {
      this.setTransaction(
        Transaction.fromData({
          accountId: this.accountId,
          clientId: this.clientId,
          clientName: this.clientName,
          description: 'Crédito de R$ ' + amountPayed.toFixed(2),
          paymentMethod: TransactionPaymentMethodEnum[paymentMethod],
          amount: amountPayed,
          quantity: 1,
          payedAt: new Date(),
        }),
      );
      return;
    }
    if (amountDifference <= 0) {
      this.payedAt = new Date();
      this.setTransaction(
        Transaction.fromData({
          accountId: this.accountId,
          clientId: this.clientId,
          clientName: this.clientName,
          description: 'Crédito de R$ ' + amountPayed.toFixed(2),
          paymentMethod: TransactionPaymentMethodEnum[paymentMethod],
          amount: amountPayed,
          quantity: 1,
          payedAt: this.payedAt,
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
  getAmountPayed() {
    return this.amountPayed;
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

  getAmountDifference() {
    return this.amount - this.amountPayed;
  }

  getDescription() {
    return this.description;
  }

  getTransactions() {
    return this.transactions;
  }
}
