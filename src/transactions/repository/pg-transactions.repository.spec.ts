import PgTransactionsRepository from './pg-transactions.repository';
import { Transaction } from '../entities/transaction.entity';
import { TransactionPaymentMethodEnum } from '../value-objects/transaction-payment-method.vo';

describe('PgTransactionsRepository', () => {
  let repository: PgTransactionsRepository;
  let postgresService: { query: jest.Mock };
  let guidProvider: { generate: jest.Mock };

  const tableRow = {
    id: 'tx-1',
    account_id: 'account-1',
    client_id: 'client-1',
    product_id: 'product-1',
    client_name: 'Maria',
    description: '2 x R$ 3.5 - Salgado',
    payment_method: 'PIX',
    amount: 700,
    quantity: 2,
    created_at: new Date('2026-01-01T10:00:00Z'),
    updated_at: new Date('2026-01-01T10:00:00Z'),
    payed_at: new Date('2026-01-01T10:00:00Z'),
  };

  beforeEach(() => {
    postgresService = { query: jest.fn() };
    guidProvider = { generate: jest.fn().mockReturnValue('generated-id') };
    repository = new PgTransactionsRepository(
      postgresService as any,
      guidProvider as any,
    );
  });

  describe('save', () => {
    it('inserts with a guid-generated id and the transaction account_id', async () => {
      postgresService.query.mockResolvedValue([tableRow]);

      const transaction = Transaction.fromData({
        accountId: 'account-1',
        clientId: 'client-1',
        productId: 'product-1',
        clientName: 'Maria',
        description: '2 x R$ 3.5 - Salgado',
        paymentMethod: TransactionPaymentMethodEnum.PIX,
        amount: 700,
        quantity: 2,
      });

      await repository.save(transaction);

      expect(postgresService.query).toHaveBeenCalledTimes(1);
      const [sql, params] = postgresService.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO transactions');
      expect(params[0]).toBe('generated-id');
      expect(params[1]).toBe('account-1');
      expect(guidProvider.generate).toHaveBeenCalledTimes(1);
    });

    it('returns a Transaction built from the persisted row', async () => {
      postgresService.query.mockResolvedValue([tableRow]);

      const saved = await repository.save(
        Transaction.fromData({
          accountId: 'account-1',
          clientId: 'client-1',
          clientName: 'Maria',
          description: '2 x R$ 3.5 - Salgado',
          paymentMethod: TransactionPaymentMethodEnum.PIX,
          amount: 700,
          quantity: 2,
        }),
      );

      expect(saved.getId()).toBe('tx-1');
      expect(saved.getAccountId()).toBe('account-1');
      expect(saved.getAmount()).toBe(700);
      expect(saved.getQuantity()).toBe(2);
      expect(saved.getPaymentMethod()).toBe('PIX');
    });

    it('always writes with parameterized values', async () => {
      postgresService.query.mockResolvedValue([tableRow]);

      await repository.save(
        Transaction.fromData({
          accountId: 'account-1',
          clientId: 'client-1',
          clientName: "Maria'); DROP TABLE transactions;--",
          description: 'desc',
          paymentMethod: TransactionPaymentMethodEnum.CASH,
          amount: 10,
          quantity: 1,
        }),
      );

      const [, params] = postgresService.query.mock.calls[0];
      expect(params).toContain("Maria'); DROP TABLE transactions;--");
    });
  });
});
