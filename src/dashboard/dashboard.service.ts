import { Injectable } from '@nestjs/common';
import { PostgresService } from 'src/postgres/postgres.service';
import { QueryTotalSaleDto } from './dto/query-total-sale.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly postgresService: PostgresService) {}
  async getTotalSales(filter: QueryTotalSaleDto): Promise<{ total: number }> {
    const { accountId, paymentMethod, startDate, endDate } = filter;
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [`WHERE account_id = $${queryParams.length}`];
    if (paymentMethod) {
      queryParts.push(`AND payment_method = $${queryParams.length + 1}`);
      queryParams.push(paymentMethod);
    }
    if (startDate) {
      queryParts.push(`AND created_at >= $${queryParams.length + 1}`);
      queryParams.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      queryParts.push(`AND created_at <= $${queryParams.length + 1}`);
      queryParams.push(`${endDate} 23:59:59`);
    }
    const finalQuery = queryParts.join(' ');
    const queryTotal = `SELECT sum(amount * quantity) as total FROM transactions ${finalQuery}`;
    const row = await this.postgresService.query<{ total: number }>(
      queryTotal,
      queryParams,
    );

    return {
      total: Number(row[0].total) ?? 0,
    };
  }
}
