import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class QueryHistoryChargeDto {
  @ApiPropertyOptional()
  @IsOptional()
  clientId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  page?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  perPage?: number;
  @ApiPropertyOptional()
  @IsOptional()
  sortBy?: string;
  @ApiPropertyOptional()
  @IsOptional()
  orderDir?: 'asc' | 'desc';
  accountId: string;
  constructor(partial: Partial<QueryHistoryChargeDto>) {
    Object.assign(this, partial);
    this.perPage = this.perPage || 10;
    this.page = this.page || 1;
    this.orderDir = this.orderDir || 'asc';
    this.sortBy = `bh.${this.sortBy}` || 'bh.created_at';
  }
}
