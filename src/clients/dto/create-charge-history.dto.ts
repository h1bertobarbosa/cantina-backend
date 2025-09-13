import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsISO8601 } from 'class-validator';

export class CreateChargeDto {
  @ApiProperty({
    description: 'Descrição que o usuário digitou',
    example: 'Descrição que o usuário digitou',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Valor da cobrança',
    example: 199.9,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Data de criação da cobrança',
    example: '2025-09-13T12:02:43.000Z',
  })
  @IsISO8601()
  createdAt: string;
}
