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
    const [clients, row] = await Promise.all([
      this.postgresService.query<ClientTable>(
        'SELECT * FROM clients WHERE account_id = $1 ORDER BY $2 LIMIT $3 OFFSET $4',
        [
          Number(input.accountId),
          `${input.orderBy} ${input.orderDir.toUpperCase()}`,
          input.perPage,
          (input.page - 1) * input.perPage,
        ],
      ),
      this.postgresService.query<ClientTable>(
        'SELECT COUNT(*) FROM clients WHERE account_id = $1',
        [Number(input.accountId)],
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
    const [product] = await this.postgresService.query<ClientTable>(
      `SELECT * FROM clients WHERE id = $1`,
      [id],
    );
    if (!product || product.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }
    return new OutputClientDto(product);
  }
  /**
   * 

  findOne(id: number) {
    return `This action returns a #${id} client`;
  }

  update(id: number, updateClientDto: UpdateClientDto) {
    return `This action updates a #${id} client`;
  }

  remove(id: number) {
    return `This action removes a #${id} client`;
  }
   */
}
