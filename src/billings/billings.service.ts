import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PayBillingDto } from './dto/pay-billing.dto';
import { QueryBillingDto } from './dto/query-billing.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import { BillingsTable } from './repository/ports/billint-table.interface';
import OutputBillingDto from './dto/output-billing.dto';
import Billing from './entities/billing.entity';
import { ClientTable } from 'src/clients/clients.service';
import {
  TRANSACTIONS_REPOSITORY,
  TransactionsRepository,
} from 'src/transactions/repository/transactions-repository.interface';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import BillingFacade from './facades/billing.facade';
import { BillingItemTypeEnum } from './entities/billing-item-type.vo';
export interface InputGetById {
  id: string;
  accountId: string;
}
@Injectable()
export class BillingsService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionRepository: TransactionsRepository,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
    private readonly payBillingFacade: BillingFacade,
  ) {}
  async findAll({
    accountId,
    clientId,
    orderBy,
    orderDir,
    perPage,
    page,
  }: QueryBillingDto) {
    const queryParams: (string | number | Date)[] = [accountId];
    const queryParts: string[] = [
      `transactions WHERE account_id = $${queryParams.length}`,
    ];

    if (clientId) {
      queryParts.push(`AND client_id = $${queryParams.length + 1}`);
      queryParams.push(clientId);
    }

    queryParts.push(`ORDER BY $${queryParams.length + 1}`);
    queryParams.push(`${orderBy} ${orderDir.toUpperCase()}`);
    queryParts.push(`LIMIT $${queryParams.length + 1}`);
    queryParams.push(perPage);
    queryParts.push(`OFFSET $${queryParams.length + 1}`);
    queryParams.push((page - 1) * perPage);
    const finalQuery = queryParts.join(' ');
    const queryBillings = `SELECT * FROM ${finalQuery}`;
    const countBillings = `SELECT COUNT(*) FROM ${finalQuery}`;
    const [billings, row] = await Promise.all([
      this.postgresService.query<BillingsTable>(queryBillings, queryParams),
      this.postgresService.query<BillingsTable>(countBillings, queryParams),
    ]);

    return {
      data: billings.map((billing) => OutputBillingDto.fromTable(billing)),
      meta: {
        page,
        perPage,
        total: parseInt(row[0]['count']),
      },
    };
  }

  async findOne({ id, accountId }: InputGetById) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT * FROM billings WHERE id = $1`,
      [id],
    );
    if (!billing || billing.account_id !== accountId) {
      throw new NotFoundException('Billing not found');
    }
    return OutputBillingDto.fromTable(billing);
  }

  async payBilling(payBillingDto: PayBillingDto) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT * FROM billings WHERE id = $1`,
      [payBillingDto.billingId],
    );

    const clientName = await this.getClientName(
      billing.client_id,
      billing.account_id,
    );
    const aBilling = Billing.fromTable(billing);
    aBilling.setClienteName(clientName);
    aBilling.pay(Number(payBillingDto.amount));

    if (aBilling.getPayedAt()) {
      await this.payTotalAmount(aBilling, payBillingDto);
      return;
    }
    this.payBillingFacade.payPartialAmount(
      aBilling,
      Number(payBillingDto.amount),
      payBillingDto.paymentMethod,
    );
    return OutputBillingDto.fromTable(billing);
  }

  private async payTotalAmount(
    aBilling: Billing,
    payBillingDto: PayBillingDto,
  ) {
    await this.payBillingFacade.payBillingAmounEqualTotal(
      aBilling,
      payBillingDto,
    );
    if (aBilling.getAmount() < 0) {
      const newBilling = await this.payBillingFacade.generateNewBilling({
        accountId: aBilling.getAccountId(),
        clientId: aBilling.getClientId(),
        clientName: aBilling.getClientName(),
        amount: aBilling.getAmount(),
      });
      const transaction = await this.payBillingFacade.generateTransactions(
        newBilling,
        payBillingDto.paymentMethod,
      );
      await this.payBillingFacade.generateBillingItems(
        newBilling,
        transaction,
        BillingItemTypeEnum.CREDIT,
      );
    }
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
