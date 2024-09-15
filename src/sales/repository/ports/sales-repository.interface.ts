import Billing from 'src/sales/entities/billing.entity';
import { Sale } from 'src/sales/entities/sale.entity';
export interface BillingExistsFilter {
  accountId: string;
  clientId: string;
  status: string;
}
export interface SalesRepository {
  create(createSaleDto: Sale): Promise<Sale>;
  findOne(id: string): Promise<Sale>;
  remove(id: string): Promise<Sale>;
  billingExists(filter: BillingExistsFilter): Promise<boolean>;
  saveBilling(): Promise<Billing>;
}

export const SALES_REPOSITORY = Symbol('SALES_REPOSITORY');
