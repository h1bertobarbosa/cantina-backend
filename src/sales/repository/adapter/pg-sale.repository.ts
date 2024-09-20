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

export class PgSaleRepository implements SalesRepository {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}

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
}
