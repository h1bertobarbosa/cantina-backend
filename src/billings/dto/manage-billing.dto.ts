import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsIn,
  MaxLength,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TransactionPaymentMethodEnum } from 'src/transactions/value-objects/transaction-payment-method.vo';

export class CreateManagedBillingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;
}

export class AddBillingDebitDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;
}

export class AddBillingCreditDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: TransactionPaymentMethodEnum })
  @IsString()
  @IsNotEmpty()
  @IsIn(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'CASH'])
  paymentMethod: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  description?: string;
}

class ManagedBillingSaleItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class AddBillingSaleDto {
  @ApiProperty({ type: [ManagedBillingSaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManagedBillingSaleItemDto)
  items: ManagedBillingSaleItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  buyDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientId?: string;
}

export class ReverseBillingItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
