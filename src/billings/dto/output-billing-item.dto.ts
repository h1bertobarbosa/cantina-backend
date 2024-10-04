import { BillingItemsTable } from '../repository/ports/billint-table.interface';

export default class OutputBillingItemDto {
  private constructor(
    readonly id: string,
    readonly clientName: string,
    readonly description: string,
    readonly type: string,
    readonly amount: number,
    readonly paymentMethod: string,
    readonly createdAt?: Date,
  ) {}

  static fromTable(billing: BillingItemsTable) {
    return new OutputBillingItemDto(
      billing.id,
      billing.client_name,
      billing.description,
      billing.type,
      Number(billing.amount),
      billing.payment_method,
      billing.created_at,
    );
  }
}
