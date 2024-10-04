import { Product } from 'src/products/entities/product.entity';

export default class CreateTransactionDescription {
  static execute(product: Product, quantity: number) {
    return `${quantity} x R$ ${product.getPrice()} - ${product.getName()}`;
  }
}
