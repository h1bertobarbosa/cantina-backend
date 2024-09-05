import { ApiProperty } from '@nestjs/swagger';
import { ProductTable } from '../products.service';

export class OutputProductDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  price: number;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;

  constructor(product: ProductTable) {
    this.id = product.external_id;
    this.name = product.name;
    this.price = product.price;
    this.createdAt = product.created_at;
    this.updatedAt = product.updated_at;
  }
}
