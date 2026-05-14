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

const ORDER_BY_MAP = {
  created_at: 'billings.created_at',
  amount: 'billings.amount',
  payed_at: 'billings.payed_at',
  client_name: 'clients.name',
} as const;

function resolveOrderBy(orderBy?: string) {
  if (orderBy && orderBy in ORDER_BY_MAP) {
    return ORDER_BY_MAP[orderBy as keyof typeof ORDER_BY_MAP];
  }

  return ORDER_BY_MAP.created_at;
}

@Injectable()
export class BillingsService {
  constructor(private readonly postgresService: PostgresService) {}
  async findAll({
    accountId,
    search,
    clientId,
    status,
    orderBy,
    orderDir,
    perPage,
    page,
  }: QueryBillingDto) {
    const safeOrderBy = resolveOrderBy(orderBy);
    const safeOrderDir = orderDir === 'asc' ? 'ASC' : 'DESC';
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [
      `billings JOIN clients ON clients.id = billings.client_id WHERE billings.account_id = $${queryParams.length}`,
    ];

    if (search?.trim()) {
      queryParams.push(`%${search.trim()}%`);
      const searchParamIndex = queryParams.length;
      queryParts.push(
        `AND (clients.name ILIKE $${searchParamIndex} OR billings.description ILIKE $${searchParamIndex})`,
      );
    }
    if (clientId) {
      queryParts.push(`AND client_id = $${queryParams.length + 1}`);
      queryParams.push(clientId);
    }
    if (status === 'paid') {
      queryParts.push(`AND billings.payed_at IS NOT NULL`);
    }
    if (status === 'pending') {
      queryParts.push(`AND billings.payed_at IS NULL`);
    }
    const finalQueryCount = queryParts.join(' ');
    const queryParamsCount = [...queryParams];
    queryParts.push(`ORDER BY ${safeOrderBy} ${safeOrderDir}`);
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
      `SELECT bi.id,bi.type,bi.created_at,t.created_at AS sale_created_at,t.amount,t.client_name,t.description,t.payment_method 
       FROM billing_items bi
       JOIN transactions t ON t.id = bi.transaction_id
       WHERE bi.billing_id = $1 AND t.account_id = $2`,
      [id, accountId],
    );
    return items.map((item) => OutputBillingItemDto.fromTable(item));
  }
}
