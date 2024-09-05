import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class QueryProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  search?: string;
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
  orderBy?: string;
  @ApiPropertyOptional()
  @IsOptional()
  orderDir?: 'asc' | 'desc';
  accountId: string;
  constructor(partial: Partial<QueryProductDto>) {
    Object.assign(this, partial);
    this.perPage = this.perPage || 10;
    this.page = this.page || 1;
    this.orderDir = this.orderDir || 'asc';
    this.orderBy = this.orderBy || 'name';
  }
}
