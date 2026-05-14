import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  HASHING_PROVIDER,
  HashingProvider,
} from 'src/libs/src/hashing/contract/hashing-provider.interface';
import { PostgresService } from 'src/postgres/postgres.service';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { UsersTable } from './ports/users-table.interface';
import { OutputUserDto } from './dto/output-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdatePasswordUserDto } from './dto/update-password-user.dto';

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
export class UsersService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(HASHING_PROVIDER)
    private readonly hashingProvider: HashingProvider,
    @Inject(GUID_PROVIDER)
    private readonly guidProvider: GuidProvider,
  ) {}
  async create(createUserDto: CreateUserDto): Promise<OutputUserDto> {
    const [user] = await this.postgresService.query<UsersTable>(
      'INSERT INTO users(id, account_id, name, email, password) VALUES ($1, $2,$3,$4, $5) RETURNING *',
      [
        this.guidProvider.generate(),
        createUserDto.accountId,
        createUserDto.name,
        createUserDto.email,
        await this.hashingProvider.hash(createUserDto.password),
      ],
    );
    return OutputUserDto.fromTable(user);
  }

  async findAll(queryUserDto: QueryUserDto) {
    const orderBy = resolveOrderBy(queryUserDto.orderBy);
    const orderDir = queryUserDto.orderDir === 'desc' ? 'DESC' : 'ASC';
    const params: Array<string | number> = [queryUserDto.accountId];
    const filters: string[] = ['account_id = $1'];

    if (queryUserDto.search?.trim()) {
      params.push(`%${queryUserDto.search.trim()}%`);
      const searchParamIndex = params.length;
      filters.push(
        `(name ILIKE $${searchParamIndex} OR email ILIKE $${searchParamIndex})`,
      );
    }

    const whereClause = filters.join(' AND ');
    params.push(
      queryUserDto.perPage,
      (queryUserDto.page - 1) * queryUserDto.perPage,
    );
    const limitParamIndex = params.length - 1;
    const offsetParamIndex = params.length;

    const [users, row] = await Promise.all([
      this.postgresService.query<UsersTable>(
        `SELECT * FROM users WHERE ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        params,
      ),
      this.postgresService.query<UsersTable>(
        `SELECT COUNT(*) FROM users WHERE ${whereClause}`,
        params.slice(0, limitParamIndex - 1),
      ),
    ]);

    return {
      data: users.map((user) => OutputUserDto.fromTable(user)),
      meta: {
        page: queryUserDto.page,
        perPage: queryUserDto.perPage,
        total: Number(row[0]['count']),
      },
    };
  }

  async findOne({ id, accountId }: InputGetById) {
    const [user] = await this.postgresService.query<UsersTable>(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    if (!user || user.account_id !== accountId) {
      throw new NotFoundException('User not found');
    }
    return OutputUserDto.fromTable(user);
  }

  async update(updateUserDto: UpdateUserDto) {
    const [user] = await this.postgresService.query<UsersTable>(
      `UPDATE users SET name = $1, email = $2, updated_at = $3 WHERE id = $4 AND account_id = $5 RETURNING *`,
      [
        updateUserDto.name,
        updateUserDto.email,
        new Date(),
        updateUserDto.id,
        updateUserDto.accountId,
      ],
    );
    if (!user || user.account_id !== updateUserDto.accountId) {
      throw new NotFoundException('User not found');
    }
    return OutputUserDto.fromTable(user);
  }

  async remove({ id, accountId }: InputGetById) {
    await this.postgresService.query<UsersTable>(
      `DELETE FROM users WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
  }

  async updatePassword(updateUserDto: UpdatePasswordUserDto) {
    const [user] = await this.postgresService.query<UsersTable>(
      `UPDATE users SET password = $1, updated_at = $2 WHERE id = $3 AND account_id = $4 RETURNING *`,
      [
        await this.hashingProvider.hash(updateUserDto.password),
        new Date(),
        updateUserDto.id,
        updateUserDto.accountId,
      ],
    );
    if (!user || user.account_id !== updateUserDto.accountId) {
      throw new NotFoundException('User not found');
    }
    return OutputUserDto.fromTable(user);
  }
}
