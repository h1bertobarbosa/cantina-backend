import { BillingsTable } from '../repository/ports/billint-table.interface';

export default class OutputBillingDto {
  private constructor(
    readonly id: string,
    readonly clientId: string,
    readonly description: string,
    readonly amount: number,
    readonly paymentMethod: string,
    readonly payedAt?: Date,
    readonly createdAt?: Date,
    readonly updatedAt?: Date,
  ) {}

  static fromTable(billing: BillingsTable) {
    return new OutputBillingDto(
      billing.id,
      billing.client_id,
      billing.description,
      Number(billing.amount),
      billing.payment_method,
      billing.payed_at,
      billing.created_at,
      billing.updated_at,
    );
  }
}
