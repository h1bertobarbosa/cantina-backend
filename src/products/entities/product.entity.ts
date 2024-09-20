import { ProductTable } from '../products.service';

export class Product {
  private id: string;
  private name: string;
  private price: number;
  constructor(input: ProductTable) {
    this.id = input.id;
    this.name = input.name;
    this.price = input.price;
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getPrice() {
    return this.price;
  }
}
