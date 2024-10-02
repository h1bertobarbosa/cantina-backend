import { BillingsTable } from '../repository/ports/billint-table.interface';

export default class OutputBillingDto {
  private constructor(
    readonly id: string,
    readonly clientId: string,
    readonly description: string,
    readonly amount: number,
    readonly amountPayed: number,
    readonly paymentMethod: string,
    readonly payedAt?: Date,
    readonly createdAt?: Date,
    readonly updatedAt?: Date,
    readonly clientName?: string,
  ) {}

  static fromTable(billing: BillingsTable & { name?: string }) {
    return new OutputBillingDto(
      billing.id,
      billing.client_id,
      billing.description,
      Number(billing.amount),
      Number(billing.amount_payed),
      billing.payment_method,
      billing.payed_at,
      billing.created_at,
      billing.updated_at,
      billing.name,
    );
  }
}
