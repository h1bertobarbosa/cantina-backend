import { ForbiddenException, Injectable } from '@nestjs/common';
import { PostgresService } from 'src/postgres/postgres.service';
import { QueryLogDto } from './dto/query-log.dto';

export const AUDIT_ALLOWED_EMAIL = 'humberto.obarbosa@gmail.com';

interface LogTable {
  id: string;
  account_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  data: unknown;
  log_type: string;
  obs: string | null;
  created_at: Date;
}

interface AccountTable {
  id: string;
  name: string;
  slug: string;
}

const LOG_ORDER_BY_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  log_type: 'log_type',
  user_email: 'user_email',
  user_name: 'user_name',
};

@Injectable()
export class LogsService {
  constructor(private readonly postgresService: PostgresService) {}

  async findAccounts(userEmail: string) {
    this.assertAuditAccess(userEmail);

    const accounts = await this.postgresService.query<AccountTable>(
      'SELECT id, name, slug FROM accounts ORDER BY name ASC',
    );

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      slug: account.slug,
    }));
  }

  async findAll(query: QueryLogDto, userEmail: string) {
    this.assertAuditAccess(userEmail);

    const params: (string | number)[] = [];
    const whereParts: string[] = [];

    if (query.accountId) {
      params.push(query.accountId);
      whereParts.push(`account_id = $${params.length}`);
    }

    if (query.logType) {
      params.push(query.logType);
      whereParts.push(`log_type = $${params.length}`);
    }

    if (query.userEmail) {
      params.push(`%${query.userEmail}%`);
      whereParts.push(`user_email ILIKE $${params.length}`);
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      whereParts.push(
        `(obs ILIKE $${params.length} OR data::text ILIKE $${params.length})`,
      );
    }

    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(' AND ')}`
      : '';
    const safeOrderBy =
      LOG_ORDER_BY_COLUMNS[query.orderBy || 'created_at'] ||
      LOG_ORDER_BY_COLUMNS.created_at;
    const safeOrderDir =
      query.orderDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const [logs, row] = await Promise.all([
      this.postgresService.query<LogTable>(
        `SELECT id, account_id, user_id, user_name, user_email, data, log_type, obs, created_at
         FROM logs
         ${whereClause}
         ORDER BY ${safeOrderBy} ${safeOrderDir}
         LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        [...params, query.perPage, (query.page - 1) * query.perPage],
      ),
      this.postgresService.query<{ count: string }>(
        `SELECT COUNT(*) FROM logs ${whereClause}`,
        params,
      ),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        account_id: log.account_id,
        user_id: log.user_id,
        user_name: log.user_name,
        user_email: log.user_email,
        data: log.data,
        log_type: log.log_type,
        obs: log.obs,
        created_at: log.created_at,
      })),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total: Number(row[0]?.count || 0),
      },
    };
  }

  private assertAuditAccess(userEmail: string) {
    if (userEmail !== AUDIT_ALLOWED_EMAIL) {
      throw new ForbiddenException('Audit access denied');
    }
  }
}
