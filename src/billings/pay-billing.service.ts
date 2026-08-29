import { PostgresService } from 'src/postgres/postgres.service';
import { PayBillingDto } from './dto/pay-billing.dto';
import { BillingsTable } from './repository/ports/billint-table.interface';
import {
  Inject,
  Injectable,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { ClientTable } from 'src/clients/clients.service';
import Billing from './entities/billing.entity';
import BillingFacade from './facades/billing.facade';
import OutputBillingDto from './dto/output-billing.dto';
import { BillingItemTypeEnum } from './entities/billing-item-type.vo';
import { TransactionPaymentMethodEnum } from 'src/transactions/value-objects/transaction-payment-method.vo';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { LOGGER } from 'src/logger/logger.const';

interface PayBillingInput extends PayBillingDto {
  userId: string;
  userName: string;
  userEmail: string;
}

@Injectable()
export default class PayBillingService {
  constructor(
    private readonly postgresService: PostgresService,
    private readonly payBillingFacade: BillingFacade,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
    @Inject(LOGGER) private readonly logger: LoggerService,
  ) {}
  async execute(payBillingDto: PayBillingInput) {
    const [billing] = await this.postgresService.query<BillingsTable>(
      `SELECT * FROM billings WHERE id = $1`,
      [payBillingDto.billingId],
    );
    if (!billing || billing.account_id !== payBillingDto.accountId) {
      throw new NotFoundException('Billing not found');
    }

    const clientName = await this.getClientName(
      billing.client_id,
      billing.account_id,
    );
    const aBilling = Billing.fromTable({
      ...billing,
      amount_payed: payBillingDto.amount.toFixed(2),
    });
    aBilling.setClienteName(clientName);
    aBilling.pay(Number(payBillingDto.amount), payBillingDto.paymentMethod);

    if (aBilling.getPayedAt()) {
      await this.payTotalAmount(aBilling, payBillingDto);
    } else {
      await this.payBillingFacade.payPartialAmount(aBilling);
    }
    await this.logPayBilling(payBillingDto, billing, clientName, aBilling);
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

  private async logPayBilling(
    payBillingDto: PayBillingInput,
    billing: BillingsTable,
    clientName: string,
    aBilling: Billing,
  ) {
    const amountDifference = aBilling.getAmountDifference();
    const status =
      amountDifference < 0
        ? 'overpaid'
        : amountDifference === 0
          ? 'paid'
          : 'partial';

    try {
      await this.postgresService.query(
        'INSERT INTO logs (id, account_id, user_id, user_name, user_email, data, log_type, obs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          this.guidProvider.generate(),
          billing.account_id,
          payBillingDto.userId,
          payBillingDto.userName,
          payBillingDto.userEmail,
          JSON.stringify({
            billing: {
              id: billing.id,
              clientId: billing.client_id,
              clientName,
              description: billing.description,
              amountBefore: Number(billing.amount),
              amountPayedBefore: Number(billing.amount_payed),
              amountPayedInput: payBillingDto.amount,
              amountAfter: Math.max(amountDifference, 0),
              amountPayedAfter:
                Number(billing.amount_payed) + payBillingDto.amount,
              paymentMethodBefore: billing.payment_method,
              paymentMethodInput: payBillingDto.paymentMethod,
              status,
              amountDifference,
              payedAt: aBilling.getPayedAt(),
            },
          }),
          'pay_billing',
          null,
        ],
      );
    } catch (error) {
      this.logger.error(
        `Failed to insert pay_billing log for user ${payBillingDto.userId}`,
        error,
      );
    }
  }
}
/*
lancei uma venda
paguei parcial
lancei outra venda
deu erro no calculo
*/
