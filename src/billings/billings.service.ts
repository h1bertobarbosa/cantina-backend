import { Injectable, NotFoundException } from '@nestjs/common';
import { QueryBillingDto } from './dto/query-billing.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import {
  BillingItemsTable,
  BillingsTable,
} from './repository/ports/billint-table.interface';
import OutputBillingDto from './dto/output-billing.dto';
import OutputBillingItemDto from './dto/output-billing-item.dto';

export interface InputGetById {
  id: string;
  accountId: string;
}
@Injectable()
export class BillingsService {
  constructor(private readonly postgresService: PostgresService) {}
  async findAll({
    accountId,
    clientId,
    orderBy,
    orderDir,
    perPage,
    page,
  }: QueryBillingDto) {
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [
      `billings JOIN clients ON clients.id = billings.client_id WHERE billings.account_id = $${queryParams.length}`,
    ];

    if (clientId) {
      queryParts.push(`AND client_id = $${queryParams.length + 1}`);
      queryParams.push(clientId);
    }
    const finalQueryCount = queryParts.join(' ');
    const queryParamsCount = [...queryParams];
    queryParts.push(`ORDER BY $${queryParams.length + 1}`);
    queryParams.push(`${orderBy} ${orderDir.toUpperCase()}`);
    queryParts.push(`LIMIT $${queryParams.length + 1}`);
    queryParams.push(perPage);
    queryParts.push(`OFFSET $${queryParams.length + 1}`);
    queryParams.push((page - 1) * perPage);
    const finalQuery = queryParts.join(' ');
    const queryBillings = `SELECT billings.*,clients.name FROM ${finalQuery} `;
    const countBillings = `SELECT COUNT(billings.*) FROM ${finalQueryCount}`;
    const [billings, row] = await Promise.all([
      this.postgresService.query<BillingsTable>(queryBillings, queryParams),
      this.postgresService.query<BillingsTable>(
        countBillings,
        queryParamsCount,
      ),
    ]);

    return {
      data: billings.map((billing) => OutputBillingDto.fromTable(billing)),
      meta: {
        page,
        perPage,
        total: parseInt(row[0]['count']),
      },
    };
  }

  async findOne({ id, accountId }: InputGetById) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT b.*,c.name FROM billings b
        JOIN clients c ON c.id = b.client_id
        WHERE b.id = $1`,
      [id],
    );
    if (!billing || billing.account_id !== accountId) {
      throw new NotFoundException('Billing not found');
    }
    return OutputBillingDto.fromTable(billing);
  }

  async getBillingItems({ id, accountId }: InputGetById) {
    const items = await this.postgresService.query<BillingItemsTable>(
      `SELECT bi.id,bi.type,bi.created_at,t.amount,t.client_name,t.description,t.payment_method,bi.purchased_at 
       FROM billing_items bi
       JOIN transactions t ON t.id = bi.transaction_id
       WHERE bi.billing_id = $1 AND t.account_id = $2`,
      [id, accountId],
    );
    return items.map((item) => OutputBillingItemDto.fromTable(item));
  }
}
