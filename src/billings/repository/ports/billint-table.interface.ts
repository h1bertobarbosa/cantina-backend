export interface BillingsTable {
  id: string;
  account_id: string;
  client_id: string;
  payment_method: string;
  description: string;
  amount: string;
  created_at: Date;
  updated_at: Date;
  payed_at: Date;
}
export interface BillingItemsTable {
  id: string;
  transaction_id: string;
  billing_id: string;
  type: string;
  created_at: Date;
  updated_at: Date;
}
