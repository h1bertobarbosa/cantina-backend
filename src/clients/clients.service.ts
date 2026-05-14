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

const ORDER_BY_MAP = {
  name: 'name',
  email: 'email',
  created_at: 'created_at',
} as const;

function resolveOrderBy(orderBy?: string) {
  if (orderBy && orderBy in ORDER_BY_MAP) {
    return ORDER_BY_MAP[orderBy as keyof typeof ORDER_BY_MAP];
  }

  return ORDER_BY_MAP.name;
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
    const orderBy = resolveOrderBy(input.orderBy);
    const orderDir = input.orderDir === 'desc' ? 'DESC' : 'ASC';
    const params: Array<string | number> = [input.accountId];
    const filters: string[] = ['account_id = $1'];

    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      const searchParamIndex = params.length;
      filters.push(
        `(name ILIKE $${searchParamIndex} OR email ILIKE $${searchParamIndex} OR phone ILIKE $${searchParamIndex})`,
      );
    }

    const whereClause = filters.join(' AND ');
    params.push(input.perPage, (input.page - 1) * input.perPage);
    const limitParamIndex = params.length - 1;
    const offsetParamIndex = params.length;

    const [clients, row] = await Promise.all([
      this.postgresService.query<ClientTable>(
        `SELECT * FROM clients WHERE ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        params,
      ),
      this.postgresService.query<ClientTable>(
        `SELECT COUNT(*) FROM clients WHERE ${whereClause}`,
        params.slice(0, limitParamIndex - 1),
      ),
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
}
