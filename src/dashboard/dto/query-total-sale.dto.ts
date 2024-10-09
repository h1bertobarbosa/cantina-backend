import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryTotalSaleDto {
  @ApiPropertyOptional()
  @IsOptional()
  paymentMethod: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  accountId: string;
  constructor(partial: Partial<QueryTotalSaleDto>) {
    Object.assign(this, partial);
    this.paymentMethod = this.paymentMethod || 'TO_RECEIVE';
  }
}
