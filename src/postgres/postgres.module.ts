import { Module, Global, DynamicModule } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
import { PostgresService } from './postgres.service';

@Global()
@Module({})
export class PostgresModule {
  static forRoot(config: PoolConfig): DynamicModule {
    const poolProvider = {
      provide: 'PG_POOL',
      useFactory: async () => {
        return new Pool(config);
      },
    };

    return {
      module: PostgresModule,
      providers: [poolProvider, PostgresService],
      exports: [PostgresService],
    };
  }
}
