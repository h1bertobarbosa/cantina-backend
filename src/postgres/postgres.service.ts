import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PostgresService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async query<T = unknown>(
    queryText: string,
    params?: unknown[],
  ): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const res = await client.query(queryText, params);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async getClient() {
    return this.pool.connect();
  }
}
