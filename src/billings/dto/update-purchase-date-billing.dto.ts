import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdatePurchaseDateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  purchaseDate: string;
}
