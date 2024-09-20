export interface BillingExistsFilter {
  accountId: string;
  clientId: string;
  status: string;
}
export interface SalesRepository {
  billingExists(filter: BillingExistsFilter): Promise<boolean>;
}

export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');
