import { BillingItemsTable } from '../repository/ports/billint-table.interface';

export default class OutputBillingItemDto {
  private constructor(
    readonly id: string,
    readonly clientId: string,
    readonly clientName: string,
    readonly description: string,
    readonly type: string,
    readonly amount: number,
    readonly paymentMethod: string,
    readonly createdAt?: Date,
    readonly purchasedAt?: Date,
    readonly reversalOfItemId?: string,
    readonly reversalReason?: string,
    readonly reversedAt?: Date,
    readonly reversedByUserId?: string,
    readonly reversedByUserName?: string,
    readonly reversedByUserEmail?: string,
    readonly reversedByItemId?: string,
  ) {}

  static fromTable(
    billing: BillingItemsTable & { reversed_by_item_id?: string },
  ) {
    return new OutputBillingItemDto(
      billing.id,
      billing.client_id,
      billing.client_name,
      billing.description,
      billing.type,
      Number(billing.amount),
      billing.payment_method,
      billing.created_at,
      billing.purchased_at,
      billing.reversal_of_item_id,
      billing.reversal_reason,
      billing.reversed_at,
      billing.reversed_by_user_id,
      billing.reversed_by_user_name,
      billing.reversed_by_user_email,
      billing.reversed_by_item_id,
    );
  }
}
