import { BillingsService } from './billings.service';

describe('BillingsService', () => {
  const logger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const guidProvider = {
    generate: jest.fn(),
  };

  it('subtracts credit items from receipt details total and updates billing amount', async () => {
    const postgresService = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FROM billings b')) {
          return Promise.resolve([
            {
              id: 'billing-id',
              account_id: 'account-id',
              name: 'Client Name',
              email: 'client@example.com',
              phone: '5551999999999',
            },
          ]);
        }

        if (sql.includes('FROM billing_items bi')) {
          return Promise.resolve([
            {
              id: 'credit-item-id',
              type: 'CREDIT',
              description: 'Crédito de R$ 72.00',
              amount: '72.00',
              purchased_at: new Date('2026-07-07T16:11:58.214Z'),
            },
            {
              id: 'debit-item-id',
              type: 'DEBIT',
              description: '3 x R$ 24 - Produto',
              amount: '72.00',
              purchased_at: new Date('2026-06-06T12:00:00.000Z'),
            },
          ]);
        }

        return Promise.resolve([]);
      }),
    };

    const service = new BillingsService(
      postgresService as never,
      guidProvider as never,
      logger,
    );

    const result = await service.receiptDetails({
      id: 'billing-id',
      accountId: 'account-id',
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        description: 'Crédito de R$ 72.00',
        type: 'CREDIT',
      }),
    );
    expect(postgresService.query).toHaveBeenCalledWith(
      `UPDATE billings SET amount = $1 WHERE id = $2 AND payment_method = 'TO_RECEIVE'`,
      [0, 'billing-id'],
    );
  });
});
