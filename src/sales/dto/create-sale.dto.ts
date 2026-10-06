import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';

class Item {
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

export class CreateSaleDto {
  @ApiProperty({ type: [Item] })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => Item)
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
