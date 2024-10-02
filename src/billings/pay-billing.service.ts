import { PostgresService } from 'src/postgres/postgres.service';
import { PayBillingDto } from './dto/pay-billing.dto';
import { BillingsTable } from './repository/ports/billint-table.interface';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientTable } from 'src/clients/clients.service';
import Billing from './entities/billing.entity';
import BillingFacade from './facades/billing.facade';
import OutputBillingDto from './dto/output-billing.dto';
import { BillingItemTypeEnum } from './entities/billing-item-type.vo';
import { TransactionPaymentMethodEnum } from 'src/transactions/value-objects/transaction-payment-method.vo';

@Injectable()
export default class PayBillingService {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly payBillingFacade: BillingFacade,
  ) {}
  async execute(payBillingDto: PayBillingDto) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT * FROM billings WHERE id = $1`,
      [payBillingDto.billingId],
    );

    const clientName = await this.getClientName(
      billing.client_id,
      billing.account_id,
    );
    const aBilling = Billing.fromTable({
      ...billing,
      amount_payed: payBillingDto.amount.toFixed(2),
    });
    aBilling.setClienteName(clientName);
    aBilling.pay(Number(payBillingDto.amount));

    if (aBilling.getPayedAt()) {
      await this.payTotalAmount(aBilling, payBillingDto);
      return;
    }
    await this.payBillingFacade.payPartialAmount(
      aBilling,
      Number(payBillingDto.amount),
      payBillingDto.paymentMethod,
    );
    return OutputBillingDto.fromTable(billing);
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
  private async payTotalAmount(
    aBilling: Billing,
    payBillingDto: PayBillingDto,
  ) {
    await this.payBillingFacade.payBillingAmounEqualTotal(
      aBilling,
      payBillingDto,
    );
    if (aBilling.getAmountDifference() < 0) {
      const newBilling = await this.payBillingFacade.generateNewBilling({
        accountId: aBilling.getAccountId(),
        clientId: aBilling.getClientId(),
        amount: 0,
        amountPayed: Math.abs(aBilling.getAmountDifference()),
        paymentMethod: TransactionPaymentMethodEnum.TO_RECEIVE,
      });
      newBilling.setClienteName(aBilling.getClientName());
      const transaction = await this.payBillingFacade.generateCreditTransaction(
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
}
