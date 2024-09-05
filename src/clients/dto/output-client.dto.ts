import { ApiProperty } from '@nestjs/swagger';
import { ClientTable } from '../clients.service';

export class OutputClientDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  phone: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;

  constructor(product: ClientTable) {
    this.id = product.id;
    this.name = product.name;
    this.phone = product.phone;
    this.email = product.email;
    this.createdAt = product.created_at;
    this.updatedAt = product.updated_at;
  }
}
