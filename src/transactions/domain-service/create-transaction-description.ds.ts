import { Product } from 'src/products/entities/product.entity';

export default class CreateTransactionDescription {
  static execute(product: Product, quantity: number) {
    return `${quantity} x ${product.getPrice()} - ${product.getName()}`;
  }
}
