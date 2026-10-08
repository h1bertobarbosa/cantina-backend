import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { CreateClientDto } from './dto/create-client.dto';
// import { UpdateClientDto } from './dto/update-client.dto';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { PostgresService } from 'src/postgres/postgres.service';
import { OutputClientDto } from './dto/output-client.dto';
import { QueryClientDto } from './dto/query-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryHistoryChargeDto } from './dto/query-history-charge.dto';
export interface ClientTable {
  id: string;
  account_id: string;
  responsible_client_id: string | null;
  name: string;
  email: string;
  phone: string;
  created_at: Date;
  updated_at: Date;
}

interface ManageDependencyInput {
  accountId: string;
  responsibleClientId: string;
  dependentClientId: string;
  userId: string;
  userName: string;
  userEmail: string;
}

const CLIENT_ORDER_BY_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  createdAt: 'created_at',
  created_at: 'created_at',
  updatedAt: 'updated_at',
  updated_at: 'updated_at',
};
export interface InputGetById {
  id: string;
  accountId: string;
}

const CHARGE_HISTORY_ORDER_BY_COLUMNS: Record<string, string> = {
  client_name: 'c.name',
  description: 'bh.description',
  amount: 'bh.amount',
  created_at: 'bh.ocurrency_date',
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}
  async create(createClientDto: CreateClientDto) {
    const [newClient] = await this.postgresService.query<ClientTable>(
      `INSERT INTO clients (id, account_id, name, phone, email) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        this.guidProvider.generate(),
        createClientDto.accountId,
        createClientDto.name,
        createClientDto.phone,
        createClientDto.email,
      ],
    );
    return new OutputClientDto(newClient);
  }

  async findAll(input: QueryClientDto) {
    const whereParts = ['account_id = $1'];
    const params: (string | number)[] = [input.accountId];

    if (input.search) {
      whereParts.push('(name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2)');
      params.push(`%${input.search}%`);
    }

    // Calculate parameter indexes for pagination
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const whereClause = whereParts.join(' AND ');
    const safeOrderBy = CLIENT_ORDER_BY_COLUMNS[input.sortBy] || 'name';
    const safeOrderDir = input.orderDir === 'desc' ? 'DESC' : 'ASC';
    const orderClause = `${safeOrderBy} ${safeOrderDir}`;

    const query = `SELECT * FROM clients WHERE ${whereClause} ORDER BY ${orderClause} LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    params.push(input.perPage, (input.page - 1) * input.perPage);

    const countQuery = `SELECT COUNT(*) FROM clients WHERE ${whereClause}`;
    const countParams = params.slice(0, params.length - 2);

    const [clients, row] = await Promise.all([
      this.postgresService.query<ClientTable>(query, params),
      this.postgresService.query<ClientTable>(countQuery, countParams),
    ]);

    return {
      data: clients.map((product) => new OutputClientDto(product)),
      meta: {
        page: input.page,
        perPage: input.perPage,
        total: row[0]['count'],
      },
    };
  }
  async findOne({ id, accountId }: InputGetById) {
    const [client] = await this.postgresService.query<ClientTable>(
      `SELECT * FROM clients WHERE id = $1`,
      [id],
    );
    if (!client || client.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }
    return new OutputClientDto(client);
  }

  async findDependencyDetails({ id, accountId }: InputGetById) {
    const [client] = await this.postgresService.query<ClientTable>(
      'SELECT * FROM clients WHERE id = $1',
      [id],
    );
    if (!client || client.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }

    const responsible = client.responsible_client_id
      ? (
          await this.postgresService.query<ClientTable>(
            'SELECT * FROM clients WHERE id = $1 AND account_id = $2',
            [client.responsible_client_id, accountId],
          )
        )[0]
      : null;
    const dependents = await this.postgresService.query<ClientTable>(
      `SELECT * FROM clients
       WHERE responsible_client_id = $1 AND account_id = $2
       ORDER BY name ASC`,
      [id, accountId],
    );

    return {
      client: this.toSummary(client),
      responsible: responsible ? this.toSummary(responsible) : null,
      dependents: dependents.map((dependent) => this.toSummary(dependent)),
    };
  }

  async addDependent(input: ManageDependencyInput) {
    if (input.responsibleClientId === input.dependentClientId) {
      throw new BadRequestException('Client cannot be responsible for itself');
    }

    return this.withTransaction(async (connection) => {
      const dependent = await this.getClientForUpdate(
        input.dependentClientId,
        input.accountId,
        connection,
      );
      const responsible = await this.getClientForUpdate(
        input.responsibleClientId,
        input.accountId,
        connection,
      );

      if (dependent.responsible_client_id) {
        throw new ConflictException('Client already has a responsible client');
      }
      if (responsible.responsible_client_id) {
        throw new ConflictException('A dependent client cannot be responsible');
      }

      const dependentChildren = await connection.query<{ exists: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM clients
           WHERE account_id = $1 AND responsible_client_id = $2
         ) AS exists`,
        [input.accountId, dependent.id],
      );
      if (dependentChildren.rows[0]?.exists) {
        throw new ConflictException(
          'A responsible client cannot become a dependent',
        );
      }

      const updated = await connection.query<ClientTable>(
        `UPDATE clients
         SET responsible_client_id = $1, updated_at = current_timestamp
         WHERE id = $2 AND account_id = $3 AND responsible_client_id IS NULL
         RETURNING *`,
        [responsible.id, dependent.id, input.accountId],
      );
      if (!updated.rows[0]) {
        throw new ConflictException('Client already has a responsible client');
      }

      await this.insertDependencyLog(
        connection,
        input,
        'client_dependency_created',
        responsible,
        dependent,
      );
      return {
        responsible: this.toSummary(responsible),
        dependent: this.toSummary(dependent),
      };
    });
  }

  async removeDependent(input: ManageDependencyInput) {
    return this.withTransaction(async (connection) => {
      const dependent = await this.getClientForUpdate(
        input.dependentClientId,
        input.accountId,
        connection,
      );
      const responsible = await this.getClientForUpdate(
        input.responsibleClientId,
        input.accountId,
        connection,
      );
      const updated = await connection.query<ClientTable>(
        `UPDATE clients
         SET responsible_client_id = NULL, updated_at = current_timestamp
         WHERE id = $1 AND responsible_client_id = $2 AND account_id = $3
         RETURNING *`,
        [dependent.id, responsible.id, input.accountId],
      );
      if (!updated.rows[0]) {
        throw new NotFoundException('Client dependency not found');
      }

      await this.insertDependencyLog(
        connection,
        input,
        'client_dependency_removed',
        responsible,
        dependent,
      );
      return {
        responsible: this.toSummary(responsible),
        dependent: this.toSummary(dependent),
      };
    });
  }

  async update(updateProductDto: UpdateClientDto) {
    const row = await this.postgresService.query<ClientTable>(
      `UPDATE clients SET name = $1, phone = $2, updated_at = $3, email = $4 WHERE id = $5 AND account_id = $6 RETURNING *`,
      [
        updateProductDto.name,
        updateProductDto.phone,
        new Date(),
        updateProductDto.email,
        updateProductDto.id,
        updateProductDto.accountId,
      ],
    );
    return new OutputClientDto(row[0]);
  }
  async remove({ id, accountId }: InputGetById) {
    const [client] = await this.postgresService.query<ClientTable>(
      'SELECT * FROM clients WHERE id = $1',
      [id],
    );
    if (!client || client.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }
    const [relationship] = await this.postgresService.query<{
      exists: boolean;
    }>(
      `SELECT EXISTS(
         SELECT 1 FROM clients
         WHERE account_id = $1
           AND (id = $2 AND responsible_client_id IS NOT NULL OR responsible_client_id = $2)
       ) AS exists`,
      [accountId, id],
    );
    if (relationship?.exists) {
      throw new ConflictException(
        'Remove the client dependency before deleting this client',
      );
    }
    await this.postgresService.query(
      'DELETE FROM clients WHERE id = $1 AND account_id = $2',
      [id, accountId],
    );
  }

  private async withTransaction<T>(
    operation: (connection: PoolClient) => Promise<T>,
  ): Promise<T> {
    const connection = await this.postgresService.getClient();
    try {
      await connection.query('BEGIN');
      const result = await operation(connection);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }
  }

  private async getClientForUpdate(
    id: string,
    accountId: string,
    connection: Pick<PoolClient, 'query'>,
  ): Promise<ClientTable> {
    const result = await connection.query<ClientTable>(
      'SELECT * FROM clients WHERE id = $1 FOR UPDATE',
      [id],
    );
    const client = result.rows[0];
    if (!client || client.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  private async insertDependencyLog(
    connection: Pick<PoolClient, 'query'>,
    input: ManageDependencyInput,
    logType: 'client_dependency_created' | 'client_dependency_removed',
    responsible: ClientTable,
    dependent: ClientTable,
  ) {
    await connection.query(
      `INSERT INTO logs (
         id, account_id, user_id, user_name, user_email, data, log_type, obs
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        this.guidProvider.generate(),
        input.accountId,
        input.userId,
        input.userName,
        input.userEmail,
        JSON.stringify({
          responsible: this.toSummary(responsible),
          dependent: this.toSummary(dependent),
        }),
        logType,
        null,
      ],
    );
  }

  private toSummary(client: Pick<ClientTable, 'id' | 'name'>) {
    return { id: client.id, name: client.name };
  }

  async registerCharge(input: {
    accountId: string;
    clientId: string;
    userId: string;
    amount: number;
    description: string;
    ocurrencyDate?: Date;
  }) {
    try {
      const [newCharge] = await this.postgresService.query(
        `INSERT INTO billing_history (id, account_id, user_id, client_id, amount, description,ocurrency_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9) RETURNING *`,
        [
          this.guidProvider.generate(),
          input.accountId,
          input.userId,
          input.clientId,
          input.amount,
          input.description,
          input.ocurrencyDate,
          new Date(),
          new Date(),
        ],
      );
      return newCharge;
    } catch (error) {
      console.error('Error registering charge:', error);
    }
  }

  async findAllHistoryCharge(input: QueryHistoryChargeDto) {
    try {
      const whereParts = ['bh.account_id = $1'];
      const params: (string | number)[] = [input.accountId];

      if (input.clientId) {
        whereParts.push(`bh.client_id = $${params.length + 1}`);
        params.push(input.clientId);
      }
      if (input.search) {
        whereParts.push(`bh.description ILIKE $${params.length + 1}`);
        params.push(`%${input.search}%`);
      }
      if (input.startDate) {
        whereParts.push(`bh.ocurrency_date >= $${params.length + 1}`);
        params.push(input.startDate);
      }
      if (input.endDate) {
        whereParts.push(
          `bh.ocurrency_date < ($${params.length + 1}::date + INTERVAL '1 day')`,
        );
        params.push(input.endDate);
      }

      // Calculate parameter indexes for pagination
      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const whereClause = whereParts.join(' AND ');
      const safeOrderBy =
        CHARGE_HISTORY_ORDER_BY_COLUMNS[input.sortBy || 'created_at'] ||
        CHARGE_HISTORY_ORDER_BY_COLUMNS.created_at;
      const safeOrderDir =
        input.orderDir?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const orderClause = `${safeOrderBy} ${safeOrderDir}`;

      const query = `
    SELECT bh.id, bh.description, bh.amount, bh.ocurrency_date AS created_at, c.id AS client_id, c.name AS client_name
    FROM billing_history bh
    JOIN clients c ON c.id = bh.client_id
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
      params.push(input.perPage, (input.page - 1) * input.perPage);

      const countQuery = `
    SELECT COUNT(bh.*) FROM billing_history bh
    JOIN clients c ON c.id = bh.client_id
    WHERE ${whereClause}
  `;
      const countParams = params.slice(0, params.length - 2);

      const [charges, row] = await Promise.all([
        this.postgresService.query(query, params),
        this.postgresService.query(countQuery, countParams),
      ]);

      return {
        data: (charges as any).map((charge) => ({
          id: charge.id,
          description: charge.description,
          amount: Number(charge.amount),
          created_at: charge.created_at,
          client: {
            id: charge.client_id,
            name: charge.client_name,
          },
        })),
        meta: {
          total: Number(row[0]['count']),
          page: input.page,
          perPage: input.perPage,
        },
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
