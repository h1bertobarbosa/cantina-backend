export type BillingStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'CREDIT_BALANCE';
export type BillingItemType = 'DEBIT' | 'CREDIT';

export interface BillingsTable {
  id: string;
  account_id: string;
  client_id: string;
  payment_method: string;
  description: string;
  amount: string;
  amount_payed: string;
  status: BillingStatus;
  created_at: Date;
  updated_at: Date;
  payed_at: Date;
}
interface TransactionsTable {
  amount: string;
  client_id: string;
  client_name: string;
  description: string;
  payment_method: string;
}

export interface BillingItemsTable extends TransactionsTable {
  id: string;
  transaction_id: string;
  billing_id: string;
  type: BillingItemType;
  reversal_of_item_id: string | null;
  reversal_reason: string | null;
  reversed_at: Date | null;
  reversed_by_user_id: string | null;
  reversed_by_user_name: string | null;
  reversed_by_user_email: string | null;
  created_at: Date;
  updated_at: Date;
  purchased_at: Date;
}
