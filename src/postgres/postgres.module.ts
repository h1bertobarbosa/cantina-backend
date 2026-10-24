import { Module, Global, DynamicModule } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { PostgresService } from './postgres.service';

@Global()
@Module({})
export class PostgresModule {
  static forRootAsync(): DynamicModule {
    const poolProvider = {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return new Pool({
          user: configService.get<string>('pg.user'),
          host: configService.get<string>('pg.host'),
          database: configService.get<string>('pg.database'),
          password: configService.get<string>('pg.password'),
          port: configService.get<number>('pg.port'),
        });
      },
    };

    return {
      module: PostgresModule,
      providers: [poolProvider, PostgresService],
      exports: [PostgresService],
    };
  }
}
