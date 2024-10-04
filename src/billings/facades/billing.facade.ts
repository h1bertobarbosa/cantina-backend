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
    paymentMethod: TransactionPaymentMethodEnum;
    accountId: string;
    clientId: string;
    amount: number;
    amountPayed: number;
  }): Promise<Billing> {
    const [newBilling] = await this.postgresService.query<BillingsTable>(
      `INSERT INTO billings (id, account_id, client_id, amount,amount_payed,description,payment_method) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        this.guidProvider.generate(),
        input.accountId,
        input.clientId,
        input.amount,
        input.amountPayed,
        `Fatura: ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
        input.paymentMethod,
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
        description: `Crédito de R$ ${aBilling.getAmount().toFixed(2)}`,
        paymentMethod: TransactionPaymentMethodEnum[paymentMethod],
        amount: aBilling.getAmount(),
        payedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        quantity: 1,
      }),
    );
    return aTransaction;
  }
  async generateCreditTransaction(aBilling: Billing, paymentMethod: string) {
    const amountDifference = Math.abs(aBilling.getAmountDifference());
    const aTransaction = await this.transactionRepository.save(
      Transaction.fromData({
        accountId: aBilling.getAccountId(),
        clientId: aBilling.getClientId(),
        clientName: aBilling.getClientName(),
        description: `Crédito de R$ ${amountDifference.toFixed(2)}`,
        paymentMethod: TransactionPaymentMethodEnum[paymentMethod],
        amount: amountDifference,
        payedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        quantity: 1,
      }),
    );
    return aTransaction;
  }
  async payBillingAmounEqualTotal(
    aBilling: Billing,
    payBillingDto: PayBillingDto,
  ) {
    const aTransaction = await this.generateTransactions(
      aBilling,
      payBillingDto.paymentMethod,
    );
    const currentDate = new Date();
    await Promise.all([
      this.postgresService.query(
        `UPDATE billings SET payed_at = $1,  payment_method = $2, updated_at = $3, amount_payed = $4 WHERE id = $5`,
        [
          aBilling.getPayedAt(),
          payBillingDto.paymentMethod,
          currentDate,
          aBilling.getAmountPayed(),
          aBilling.getId(),
        ],
      ),
      this.generateBillingItems(
        aBilling,
        aTransaction,
        BillingItemTypeEnum.CREDIT,
      ),
      this.postgresService.query(
        `UPDATE transactions
          SET payment_method = $1, payed_at = $2, updated_at = $3
          FROM billing_items as bi
          WHERE transactions.id = bi.transaction_id 
            AND bi.billing_id = $4
            AND transactions.payed_at IS NULL
        `,
        [
          payBillingDto.paymentMethod,
          currentDate,
          currentDate,
          aBilling.getId(),
        ],
      ),
    ]);
  }
  async payPartialAmount(aBilling: Billing) {
    const transaction = await this.transactionRepository.save(
      aBilling.getTransactions()[0],
    );

    await Promise.all([
      this.postgresService.query(
        `UPDATE billings SET amount_payed = amount_payed + $1, updated_at = $2, amount = $3 WHERE id = $4`,
        [
          aBilling.getAmountPayed(),
          new Date(),
          aBilling.getAmountDifference(),
          aBilling.getId(),
        ],
      ),
      this.generateBillingItems(
        aBilling,
        transaction,
        BillingItemTypeEnum.CREDIT,
      ),
    ]);
  }
}
