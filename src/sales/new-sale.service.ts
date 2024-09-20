import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';

import { Transaction } from 'src/transactions/entities/transaction.entity';
import { PostgresService } from 'src/postgres/postgres.service';
import { ProductTable } from 'src/products/products.service';
import { Product } from 'src/products/entities/product.entity';
import CreateTransactionDescription from 'src/transactions/domain-service/create-transaction-description.ds';
import {
  TRANSACTIONS_REPOSITORY,
  TransactionsRepository,
} from 'src/transactions/repository/transactions-repository.interface';
import { ClientTable } from 'src/clients/clients.service';
import OutputSaleDto from './dto/output-sale.dto';

@Injectable()
export class NewSaleService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionRepository: TransactionsRepository,
  ) {}
  async execute(createSaleDto: CreateSaleDto): Promise<OutputSaleDto> {
    const [product, clientName] = await Promise.all([
      this.getProduct(createSaleDto.productId, createSaleDto.accountId),
      this.getClientName(createSaleDto.clientId, createSaleDto.accountId),
    ]);
    const aTransaction = Transaction.getInstance({
      id: '',
      account_id: createSaleDto.accountId,
      client_id: createSaleDto.clientId,
      client_name: clientName,
      description: CreateTransactionDescription.execute(
        product,
        createSaleDto.quantity,
      ),
      payment_method: createSaleDto.paymentMethod,
      amount: product.getPrice() * createSaleDto.quantity,
    });

    const createdTransaction =
      await this.transactionRepository.save(aTransaction);
    return new OutputSaleDto(
      createdTransaction.getId(),
      createdTransaction.getClientName(),
      createdTransaction.getDescription(),
      createdTransaction.getPaymentMethod(),
      createdTransaction.getAmount(),
      createdTransaction.getPayedAt(),
    );
  }

  private async getProduct(id: string, accountId: string) {
    const [product] = await this.postgresService.query<ProductTable>(
      `SELECT * FROM products WHERE id = $1`,
      [id],
    );
    if (!product || product.account_id !== accountId) {
      throw new NotFoundException('Product not found');
    }
    return new Product(product);
  }

  private async getClientName(id: string, accountId: string): Promise<string> {
    const [client] = await this.postgresService.query<ClientTable>(
      `SELECT name,account_id FROM clients WHERE id = $1`,
      [id],
    );
    if (!client || client.account_id !== accountId) {
      throw new NotFoundException('Client not found');
    }
    return client.name;
  }
}
