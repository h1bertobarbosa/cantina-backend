import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import { OutputProductDto } from './dto/output-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
export interface ProductTable {
  id: string;
  account_id: string;
  name: string;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export interface InputGetById {
  id: string;
  accountId: string;
}

const ORDER_BY_MAP = {
  name: 'name',
  price: 'price',
  created_at: 'created_at',
} as const;

function resolveOrderBy(orderBy?: string) {
  if (orderBy && orderBy in ORDER_BY_MAP) {
    return ORDER_BY_MAP[orderBy as keyof typeof ORDER_BY_MAP];
  }

  return ORDER_BY_MAP.name;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}
  async create(createProductDto: CreateProductDto) {
    const [newProduct] = await this.postgresService.query<ProductTable>(
      `INSERT INTO products (id, account_id, name, price) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        this.guidProvider.generate(),
        createProductDto.accountId,
        createProductDto.name,
        createProductDto.price,
      ],
    );
    return new OutputProductDto(newProduct);
  }

  async findAll(input: QueryProductDto) {
    const orderBy = resolveOrderBy(input.orderBy);
    const orderDir = input.orderDir === 'desc' ? 'DESC' : 'ASC';
    const params: Array<string | number> = [input.accountId];
    const filters: string[] = ['account_id = $1'];

    if (input.search?.trim()) {
      params.push(`%${input.search.trim()}%`);
      const searchParamIndex = params.length;
      filters.push(`name ILIKE $${searchParamIndex}`);
    }

    const whereClause = filters.join(' AND ');
    params.push(input.perPage, (input.page - 1) * input.perPage);
    const limitParamIndex = params.length - 1;
    const offsetParamIndex = params.length;

    const [products, row] = await Promise.all([
      this.postgresService.query<ProductTable>(
        `SELECT * FROM products WHERE ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        params,
      ),
      this.postgresService.query<ProductTable>(
        `SELECT COUNT(*) FROM products WHERE ${whereClause}`,
        params.slice(0, limitParamIndex - 1),
      ),
    ]);

    return {
      data: products.map((product) => new OutputProductDto(product)),
      meta: {
        page: input.page,
        perPage: input.perPage,
        total: row[0]['count'],
      },
    };
  }

  async findOne({ id, accountId }: InputGetById) {
    const [product] = await this.postgresService.query<ProductTable>(
      `SELECT * FROM products WHERE id = $1`,
      [id],
    );
    if (!product || product.account_id !== accountId) {
      throw new NotFoundException('Product not found');
    }
    return new OutputProductDto(product);
  }

  async update(updateProductDto: UpdateProductDto) {
    const row = await this.postgresService.query<ProductTable>(
      `UPDATE products SET name = $1, price = $2, updated_at = $3 WHERE id = $4 AND account_id = $5 RETURNING *`,
      [
        updateProductDto.name,
        updateProductDto.price,
        new Date(),
        updateProductDto.id,
        updateProductDto.accountId,
      ],
    );
    return new OutputProductDto(row[0]);
  }

  async remove({ id, accountId }: InputGetById) {
    await this.postgresService.query<ProductTable>(
      `DELETE FROM products WHERE id = $1 AND account_id = $2`,
      [id, accountId],
    );
  }
}
