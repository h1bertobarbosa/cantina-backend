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
    private quantity: number,
    private payedAt?: Date,
    private createdAt?: Date,
    private updatedAt?: Date,
    private productId?: string,
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
      Number(input.amount),
      Number(input.quantity),
      input.payed_at,
      input.created_at,
      input.updated_at,
      input.product_id,
    );
  }

  static fromData(input: {
    accountId: string;
    clientId: string;
    productId?: string;
    clientName: string;
    description: string;
    paymentMethod: TransactionPaymentMethodEnum;
    amount: number;
    quantity: number;
    payedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    return new Transaction(
      '',
      input.accountId,
      input.clientId,
      input.clientName,
      input.description,
      TransactionPaymentMethod.getInstance(input.paymentMethod),
      Number(input.amount),
      Number(input.quantity),
      input.payedAt,
      input.createdAt,
      input.updatedAt,
      input.productId,
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

  getCreatedAt() {
    return this.createdAt;
  }

  getUpdatedAt() {
    return this.updatedAt;
  }

  getProductId() {
    return this.productId;
  }

  getQuantity() {
    return this.quantity;
  }
}
