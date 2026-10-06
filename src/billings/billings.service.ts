import {
  Inject,
  Injectable,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { QueryBillingDto } from './dto/query-billing.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import {
  BillingItemsTable,
  BillingsTable,
} from './repository/ports/billint-table.interface';
import OutputBillingDto from './dto/output-billing.dto';
import OutputBillingItemDto from './dto/output-billing-item.dto';
import { TransactionTable } from '../transactions/repository/pg-transactions.repository';
import {
  GUID_PROVIDER,
  GuidProvider,
} from '../libs/src/guid/contract/guid-provider.interface';
import { LOGGER } from '../logger/logger.const';
import { ClientTable } from '../clients/clients.service';

const BILLINGS_ORDER_BY_COLUMNS: Record<string, string> = {
  client_name: 'clients.name',
  description: 'billings.description',
  amount: 'billings.amount',
  amount_payed: 'billings.amount_payed',
  payment_method: 'billings.payment_method',
  payed_at: 'billings.payed_at',
  created_at: 'billings.created_at',
};

export interface InputGetById {
  id: string;
  accountId: string;
}
export interface DeleteBillingParams extends InputGetById {
  userId: string;
  userName: string;
  userEmail: string;
  obs: string;
}
@Injectable()
export class BillingsService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
    @Inject(LOGGER) private readonly logger: LoggerService,
  ) {}
  async findAll({
    accountId,
    search,
    clientId,
    paymentMethod,
    status,
    orderBy,
    orderDir,
    perPage,
    page,
  }: QueryBillingDto) {
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [
      `billings JOIN clients ON clients.id = billings.client_id WHERE billings.account_id = $${queryParams.length}`,
    ];

    if (search) {
      queryParts.push(
        `AND (clients.name ILIKE $${queryParams.length + 1} OR billings.description ILIKE $${queryParams.length + 1})`,
      );
      queryParams.push(`%${search}%`);
    }
    if (clientId) {
      queryParts.push(`AND billings.client_id = $${queryParams.length + 1}`);
      queryParams.push(clientId);
    }
    if (paymentMethod) {
      queryParts.push(
        `AND billings.payment_method = $${queryParams.length + 1}`,
      );
      queryParams.push(paymentMethod);
    }
    if (status === 'open') {
      queryParts.push(`AND billings.status = 'OPEN'`);
    }
    if (status === 'partial') {
      queryParts.push(`AND billings.status = 'PARTIAL'`);
    }
    if (status === 'paid') {
      queryParts.push(`AND billings.status = 'PAID'`);
    }
    if (status === 'credit_balance') {
      queryParts.push(`AND billings.status = 'CREDIT_BALANCE'`);
    }
    const finalQueryCount = queryParts.join(' ');
    const queryParamsCount = [...queryParams];
    const safeOrderBy =
      BILLINGS_ORDER_BY_COLUMNS[orderBy || 'created_at'] ||
      BILLINGS_ORDER_BY_COLUMNS.created_at;
    const safeOrderDir = orderDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    queryParts.push(`ORDER BY ${safeOrderBy} ${safeOrderDir}`);
    queryParts.push(`LIMIT ${perPage}`);
    queryParts.push(`OFFSET ${(page - 1) * perPage}`);
    const finalQuery = queryParts.join(' ');
    const queryBillings = `SELECT billings.*,clients.name FROM ${finalQuery}`;
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

  async receiptDetails({ id, accountId }: InputGetById) {
    const [[billing], items] = await Promise.all([
      this.postgresService.query<ClientTable>(
        `SELECT b.*,c.name,c.email,c.phone FROM billings b
      JOIN clients c ON c.id = b.client_id
      WHERE b.id = $1 AND b.account_id = $2`,
        [id, accountId],
      ),
      this.postgresService.query<BillingItemsTable>(
        `SELECT bi.id, bi.type, t.description, t.amount, bi.purchased_at
     FROM billing_items bi
     JOIN transactions t ON t.id = bi.transaction_id
     WHERE bi.billing_id = $1 AND t.account_id = $2
     ORDER BY bi.created_at DESC`,
        [id, accountId],
      ),
    ]);

    if (!billing) {
      throw new NotFoundException('Billing not found');
    }
    return {
      client: {
        name: billing.name,
        email: billing.email,
        phone: billing.phone,
      },
      items: items.map((item) => ({
        id: item.id,
        description: item.description,
        type: item.type,
        amount: item.amount,
        purchasedAt: item.purchased_at,
      })),
    };
  }
  async getLedger(input: InputGetById) {
    const billing = await this.findOne(input);
    const items = await this.getBillingItems(input);
    const debitTotal = items.reduce(
      (sum, item) =>
        sum + (item.type === 'DEBIT' ? Math.round(item.amount * 100) : 0),
      0,
    );
    const creditTotal = items.reduce(
      (sum, item) =>
        sum + (item.type === 'CREDIT' ? Math.round(item.amount * 100) : 0),
      0,
    );
    return {
      billing,
      items,
      openAmount: billing.amount,
      ledgerTotal: (debitTotal - creditTotal) / 100,
      debitTotal: debitTotal / 100,
      creditTotal: creditTotal / 100,
      creditBalance: Math.max(0, (creditTotal - debitTotal) / 100),
    };
  }
  async getBillingItems({ id, accountId }: InputGetById) {
    const items = await this.postgresService.query<BillingItemsTable>(
      `SELECT bi.*,t.amount,t.client_name,t.description,t.payment_method,
       (SELECT r.id FROM billing_items r WHERE r.reversal_of_item_id = bi.id) AS reversed_by_item_id
       FROM billing_items bi
       JOIN transactions t ON t.id = bi.transaction_id
       WHERE bi.billing_id = $1 AND t.account_id = $2
       ORDER BY bi.created_at DESC`,
      [id, accountId],
    );
    return items.map((item) => OutputBillingItemDto.fromTable(item));
  }

  async updatePurchaseDate(id: string, date: string, accountId: string) {
    const [item] = await this.postgresService.query<{
      id: string;
      account_id: string;
    }>(
      `SELECT bi.id, t.account_id
       FROM billing_items bi
       JOIN transactions t ON t.id = bi.transaction_id
       WHERE bi.id = $1`,
      [id],
    );

    if (!item || item.account_id !== accountId) {
      throw new NotFoundException('Billing item not found');
    }

    const purchasedAt = new Date(`${date.split('T')[0]}T15:00:00Z`);
    await this.postgresService.query(
      `UPDATE billing_items SET purchased_at = $1 WHERE id = $2`,
      [purchasedAt, id],
    );
    return {
      id,
      purchased_at: purchasedAt,
    };
  }

  async deleteBilling({
    id,
    accountId,
    userId,
    userName,
    userEmail,
    obs,
  }: DeleteBillingParams) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT * FROM billings WHERE id = $1`,
      [id],
    );
    if (!billing || billing.account_id !== accountId) {
      this.logger.log(
        `Billing not found for accountId: ${accountId}, id: ${id}`,
      );
      throw new NotFoundException('Billing not found');
    }

    const transactions = await this.postgresService.query<TransactionTable>(
      `SELECT t.id,t.client_id,t.client_name,t.description,t.payment_method,t.amount,t.quantity,t.payed_at FROM transactions t 
           JOIN  billing_items b ON t.id = b.transaction_id
           WHERE b.billing_id = $1`,
      [id],
    );
    const transactionIds = transactions.map((transaction) => transaction.id);

    this.logger.log(`Deleting transactions ${transactionIds.join(', ')}`);
    await this.postgresService.query(
      'DELETE FROM transactions WHERE id = ANY($1)',
      [transactionIds],
    );
    this.logger.log(`Deleting billing items for billing ${id}`);
    await this.postgresService.query(
      'DELETE FROM billing_items WHERE billing_id = $1',
      [id],
    );
    this.logger.log(`Deleting billing ${id}`);
    await this.postgresService.query('DELETE FROM billings WHERE id = $1', [
      id,
    ]);

    await this.postgresService.query(
      'INSERT INTO logs (id, account_id, user_id, user_name, user_email, data, log_type, obs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        this.guidProvider.generate(),
        billing.account_id,
        userId,
        userName,
        userEmail,
        JSON.stringify(transactions),
        'delete_billing',
        obs,
      ],
    );
    this.logger.log(`Inserting log for billing ${id} with user ${userId}`);
  }
}
