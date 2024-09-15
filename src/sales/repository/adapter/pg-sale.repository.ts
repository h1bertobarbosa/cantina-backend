import { Sale } from 'src/sales/entities/sale.entity';
import {
  BillingExistsFilter,
  SalesRepository,
} from '../ports/sales-repository.interface';
import { Inject } from '@nestjs/common';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { PostgresService } from 'src/postgres/postgres.service';
import Billing from 'src/sales/entities/billing.entity';

export class PgSaleRepository implements SalesRepository {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}

  async saveBilling(): Promise<Billing> {
    throw new Error('Method not implemented.');
  }
  async billingExists({
    status,
    accountId,
    clientId,
  }: BillingExistsFilter): Promise<boolean> {
    const results = await this.postgresService.query(
      'SELECT EXISTS(SELECT 1 FROM billings WHERE account_id = $1 AND client_id = $2 AND status = $3)',
      [accountId, clientId, status],
    );

    return results[0]['exists'];
  }
  async create(sale: Sale): Promise<Sale> {
    throw new Error('Method not implemented.');
  }
  async findOne(id: string): Promise<Sale> {
    throw new Error('Method not implemented.');
  }
  async remove(id: string): Promise<Sale> {
    throw new Error('Method not implemented.');
  }
}
