import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteBillingDto {
  @IsString()
  @ApiProperty()
  obs: string;
}
