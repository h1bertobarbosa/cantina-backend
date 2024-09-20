import { Injectable } from '@nestjs/common';
import { UpdateSaleDto } from './dto/update-sale.dto';

import { PostgresService } from 'src/postgres/postgres.service';
import OutputSaleDto from './dto/output-sale.dto';
import { TransactionTable } from 'src/transactions/repository/pg-transactions.repository';

@Injectable()
export class SalesService {
  constructor(private readonly postgresService: PostgresService) {}

  async findAll(accountId: string): Promise<OutputSaleDto[]> {
    const transactions = await this.postgresService.query<TransactionTable>(
      'SELECT * FROM transactions WHERE account_id = $1',
      [accountId],
    );

    return transactions.map(
      (transaction) =>
        new OutputSaleDto(
          transaction.id,
          transaction.client_name,
          transaction.description,
          transaction.payment_method,
          transaction.amount,
          transaction.payed_at,
        ),
    );
  }

  findOne(id: number) {
    return `This action returns a #${id} sale`;
  }

  update(id: number, updateSaleDto: UpdateSaleDto) {
    return `This action updates a #${id} sale`;
  }

  remove(id: number) {
    return `This action removes a #${id} sale`;
  }
}
