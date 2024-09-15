import { Inject, Injectable } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import {
  SALES_REPOSITORY,
  SalesRepository,
} from './repository/ports/sales-repository.interface';

@Injectable()
export class NewSaleService {
  constructor(
    @Inject(SALES_REPOSITORY) private readonly salesRepository: SalesRepository,
  ) {}
  async execute(createSaleDto: CreateSaleDto) {
    const hasOpenBilling = await this.salesRepository.billingExists({
      accountId: createSaleDto.accountId,
      clientId: createSaleDto.clientId,
      status: 'OPEN',
    });
    if (!hasOpenBilling) {
      // criar billing
    }
    // buscar billing OPEN
    // se nao existir, criar
    // criar billing item
    // se billing item payment method for: a receber, criar transaction com valor 0
    // criar transaction

    return 'This action adds a new sale';
  }
}
