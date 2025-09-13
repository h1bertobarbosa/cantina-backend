import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
  name: string;
  email: string;
  phone: string;
  created_at: Date;
  updated_at: Date;
}
export interface InputGetById {
  id: string;
  accountId: string;
}
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
    const orderClause = `${input.sortBy} ${input.orderDir.toUpperCase()}`;

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
    await this.postgresService.query<ClientTable>(
      `DELETE FROM clients WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
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
        whereParts.push('bh.client_id = $2');
        params.push(input.clientId);
      }

      // Calculate parameter indexes for pagination
      const limitIdx = params.length + 1;
      const offsetIdx = params.length + 2;

      const whereClause = whereParts.join(' AND ');
      const orderClause = `${input.sortBy || 'bh.ocurrency_date'} ${input.orderDir?.toUpperCase() || 'DESC'}`;

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
