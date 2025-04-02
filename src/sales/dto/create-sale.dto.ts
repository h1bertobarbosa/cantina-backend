import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

class Item {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;
  @ApiProperty()
  @IsNumber()
  price: number;
  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class CreateSaleDto {
  @ApiProperty({ type: [Item] })
  @IsNotEmpty()
  items: Item[];
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientId: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
  @ApiProperty()
  @IsDateString()
  @IsOptional()
  buyDate: string;
  @IsOptional()
  accountId: string;
}
