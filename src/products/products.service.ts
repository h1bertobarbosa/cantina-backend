import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import { randomUUID } from 'crypto';
import { OutputProductDto } from './dto/output-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
export interface ProductTable {
  id: number;
  account_id: number;
  external_id: string;
  name: string;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export interface InputGetById {
  id: string;
  accountId: number;
}
@Injectable()
export class ProductsService {
  constructor(private readonly postgresService: PostgresService) {}
  async create(createProductDto: CreateProductDto) {
    const [newProduct] = await this.postgresService.query<ProductTable>(
      `INSERT INTO products (account_id, external_id, name, price) VALUES ($1, $2, $3, $4) RETURNING *`,
      [
        createProductDto.accountId,
        randomUUID(),
        createProductDto.name,
        createProductDto.price,
      ],
    );
    return new OutputProductDto(newProduct);
  }

  async findAll(input: QueryProductDto) {
    const [products, row] = await Promise.all([
      this.postgresService.query<ProductTable>(
        'SELECT * FROM products WHERE account_id = $1 ORDER BY $2 LIMIT $3 OFFSET $4',
        [
          Number(input.accountId),
          `${input.orderBy} ${input.orderDir.toUpperCase()}`,
          input.perPage,
          (input.page - 1) * input.perPage,
        ],
      ),
      this.postgresService.query<ProductTable>(
        'SELECT COUNT(*) FROM products WHERE account_id = $1',
        [Number(input.accountId)],
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
      `SELECT * FROM products WHERE external_id = $1 AND account_id = $2`,
      [id, accountId],
    );
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return new OutputProductDto(product);
  }

  async update(updateProductDto: UpdateProductDto) {
    await this.postgresService.query<ProductTable>(
      `UPDATE products SET name = $1, price = $2, updated_at = $3 WHERE external_id = $4 AND account_id = $5`,
      [
        updateProductDto.name,
        updateProductDto.price,
        new Date(),
        updateProductDto.id,
        updateProductDto.accountId,
      ],
    );
  }

  async remove({ id, accountId }: InputGetById) {
    await this.postgresService.query<ProductTable>(
      `DELETE FROM products WHERE external_id = $1 AND account_id = $2`,
      [id, accountId],
    );
  }
}
