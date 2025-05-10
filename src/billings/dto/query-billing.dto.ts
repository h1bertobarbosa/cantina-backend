import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional } from 'class-validator';
import { TransactionPaymentMethodEnum } from '../../transactions/value-objects/transaction-payment-method.vo';

export class QueryBillingDto {
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
  orderBy?: string;
  @ApiPropertyOptional()
  @IsOptional()
  orderDir?: 'asc' | 'desc';
  @ApiPropertyOptional({ enum: TransactionPaymentMethodEnum })
  @IsOptional()
  paymentMethod?: string;
  accountId: string;
  constructor(partial: Partial<QueryBillingDto>) {
    Object.assign(this, partial);
    this.perPage = this.perPage || 10;
    this.page = this.page || 1;
    this.orderDir = this.orderDir || 'desc';
    this.orderBy = this.orderBy || 'created_at';
    this.paymentMethod = this.paymentMethod || '';
  }
}
