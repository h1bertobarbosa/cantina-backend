import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
export class CreateSaleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId: string;
  @ApiProperty()
  @IsNumber()
  price: number;
  @ApiProperty()
  @IsNumber()
  quantity: number;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsOptional()
  accountId: string;
}
