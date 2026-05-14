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

const PRODUCT_ORDER_BY_COLUMNS: Record<string, string> = {
  name: 'name',
  price: 'price',
  created_at: 'created_at',
  updated_at: 'updated_at',
};

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
    const whereParts = ['account_id = $1'];
    const params: (string | number)[] = [input.accountId];

    if (input.search) {
      whereParts.push(`name ILIKE $${params.length + 1}`);
      params.push(`%${input.search}%`);
    }

    const safeOrderBy =
      PRODUCT_ORDER_BY_COLUMNS[input.orderBy || 'name'] ||
      PRODUCT_ORDER_BY_COLUMNS.name;
    const safeOrderDir = input.orderDir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const whereClause = whereParts.join(' AND ');
    const listQuery = `
      SELECT *
      FROM products
      WHERE ${whereClause}
      ORDER BY ${safeOrderBy} ${safeOrderDir}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `;

    params.push(input.perPage, (input.page - 1) * input.perPage);
    const countParams = params.slice(0, params.length - 2);
    const countQuery = `SELECT COUNT(*) FROM products WHERE ${whereClause}`;

    const [products, row] = await Promise.all([
      this.postgresService.query<ProductTable>(listQuery, params),
      this.postgresService.query<ProductTable>(countQuery, countParams),
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
