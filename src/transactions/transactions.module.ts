import { Module } from '@nestjs/common';
import { LibsModule } from 'src/libs/libs.module';
import { TRANSACTIONS_REPOSITORY } from './repository/transactions-repository.interface';
import PgTransactionsRepository from './repository/pg-transactions.repository';

function getProviders() {
  return [
    { provide: TRANSACTIONS_REPOSITORY, useClass: PgTransactionsRepository },
  ];
}
@Module({
  imports: [LibsModule],
  controllers: [],
  providers: getProviders(),
  exports: getProviders(),
})
export class TransactionsModule {}
