import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SALES_REPOSITORY } from './repository/ports/sales-repository.interface';
import { PgSaleRepository } from './repository/adapter/pg-sale.repository';
import { LibsModule } from 'src/libs/libs.module';
import { NewSaleService } from './new-sale.service';

@Module({
  imports: [LibsModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    NewSaleService,
    { provide: SALES_REPOSITORY, useClass: PgSaleRepository },
  ],
})
export class SalesModule {}
