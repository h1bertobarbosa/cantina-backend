import { Inject, Injectable } from '@nestjs/common';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';
import { PostgresService } from 'src/postgres/postgres.service';
import {
  TRANSACTIONS_REPOSITORY,
  TransactionsRepository,
} from 'src/transactions/repository/transactions-repository.interface';
import Billing from '../entities/billing.entity';
import { Transaction } from 'src/transactions/entities/transaction.entity';
import { PayBillingDto } from '../dto/pay-billing.dto';
import { TransactionPaymentMethodEnum } from 'src/transactions/value-objects/transaction-payment-method.vo';
import { BillingItemTypeEnum } from '../entities/billing-item-type.vo';
import { BillingsTable } from '../repository/ports/billint-table.interface';

@Injectable()
export default class BillingFacade {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(TRANSACTIONS_REPOSITORY)
    private readonly transactionRepository: TransactionsRepository,
    @Inject(GUID_PROVIDER) private readonly guidProvider: GuidProvider,
  ) {}

  async generateNewBilling(input: {
    accountId: string;
    clientId: string;
    clientName: string;
    amount: number;
  }): Promise<Billing> {
    const [newBilling] = await this.postgresService.query<BillingsTable>(
      `INSERT INTO billings (id, account_id, client_id, client_name, amount,description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        this.guidProvider.generate(),
        input.accountId,
        input.clientId,
        input.clientName,
        input.amount,
        `Fatura: ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
      ],
    );

    return Billing.fromTable(newBilling);
  }

  async generateBillingItems(
    aBilling: Billing,
    aTransaction: Transaction,
    type: BillingItemTypeEnum,
  ) {
    await this.postgresService.query(
      `INSERT INTO billing_items (id,transaction_id, billing_id, type) VALUES ($1, $2, $3, $4)`,
      [
        this.guidProvider.generate(),
        aTransaction.getId(),
        aBilling.getId(),
        type,
      ],
    );
  }
  async generateTransactions(aBilling: Billing, paymentMethod: string) {
    const aTransaction = await this.transactionRepository.save(
      Transaction.fromData({
        accountId: aBilling.getAccountId(),
        clientId: aBilling.getClientId(),
        clientName: aBilling.getClientName(),
        description: `Credito: ${aBilling.getAmount()}`,
        paymentMethod: TransactionPaymentMethodEnum[paymentMethod],
        amount: aBilling.getAmount(),
        payedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    return aTransaction;
  }
  async payBillingAmounEqualTotal(
    aBilling: Billing,
    payBillingDto: PayBillingDto,
  ) {
    await this.postgresService.query(
      `UPDATE billings SET payed_at = $1, amount = $2 WHERE id = $3`,
      [aBilling.getPayedAt(), 0, aBilling.getId()],
    );

    const aTransaction = await this.generateTransactions(
      aBilling,
      payBillingDto.paymentMethod,
    );
    await this.generateBillingItems(
      aBilling,
      aTransaction,
      BillingItemTypeEnum.CREDIT,
    );
    await this.postgresService.query(
      `INSERT INTO billing_items (id,transaction_id, billing_id, type) VALUES ($1, $2, $3, $4)`,
      [
        this.guidProvider.generate(),
        aTransaction.getId(),
        aBilling.getId(),
        BillingItemTypeEnum.CREDIT,
      ],
    );
  }
  async payPartialAmount(
    aBilling: Billing,
    amount: number,
    paymentMethod: string,
  ) {
    await this.postgresService.query(
      `UPDATE billings SET amount = $1 WHERE id = $2`,
      [aBilling.getAmount(), aBilling.getId()],
    );
    const transaction = await this.generateTransactions(
      aBilling,
      paymentMethod,
    );
    await this.generateBillingItems(
      aBilling,
      transaction,
      BillingItemTypeEnum.CREDIT,
    );
  }
}
