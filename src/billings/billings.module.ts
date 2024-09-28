import { Module } from '@nestjs/common';
import { BillingsService } from './billings.service';
import { BillingsController } from './billings.controller';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { LibsModule } from 'src/libs/libs.module';
import PayBillingFacade from './facades/billing.facade';

@Module({
  imports: [TransactionsModule, LibsModule],
  controllers: [BillingsController],
  providers: [BillingsService, PayBillingFacade],
})
export class BillingsModule {}
