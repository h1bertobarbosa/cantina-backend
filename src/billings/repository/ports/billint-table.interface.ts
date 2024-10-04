export interface BillingsTable {
  id: string;
  account_id: string;
  client_id: string;
  payment_method: string;
  description: string;
  amount: string;
  amount_payed: string;
  created_at: Date;
  updated_at: Date;
  payed_at: Date;
}
interface TransactionsTable {
  amount: string;
  client_name: string;
  description: string;
  payment_method: string;
}

export interface BillingItemsTable extends TransactionsTable {
  id: string;
  transaction_id: string;
  billing_id: string;
  type: string;
  created_at: Date;
  updated_at: Date;
}
