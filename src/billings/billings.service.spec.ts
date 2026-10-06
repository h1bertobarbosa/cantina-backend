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

  it('returns receipt details without changing the stored balance', async () => {
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
    expect(
      postgresService.query.mock.calls.every(([sql]) =>
        sql.trim().startsWith('SELECT'),
      ),
    ).toBe(true);
    expect(postgresService.query).toHaveBeenCalledTimes(2);
  });

  it('returns stored balance and ledger diagnostics including reversal metadata', async () => {
    const pg = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'billing',
            account_id: 'account',
            client_id: 'client',
            amount: '99.00',
            amount_payed: '10.00',
            status: 'PARTIAL',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'original',
            type: 'DEBIT',
            amount: '100.00',
            reversed_by_item_id: 'reversal',
          },
          {
            id: 'reversal',
            type: 'CREDIT',
            amount: '100.00',
            reversal_of_item_id: 'original',
            reversal_reason: 'Duplicate',
            reversed_by_user_id: 'user',
            reversed_by_user_name: 'Operator',
            reversed_by_user_email: 'operator@test.local',
          },
          { id: 'debit', type: 'DEBIT', amount: '50.00' },
          { id: 'credit', type: 'CREDIT', amount: '10.00' },
        ]),
    };
    const service = new BillingsService(
      pg as never,
      guidProvider as never,
      logger,
    );
    const result = await service.getLedger({
      id: 'billing',
      accountId: 'account',
    });
    expect(result).toMatchObject({
      openAmount: 99,
      ledgerTotal: 40,
      debitTotal: 150,
      creditTotal: 110,
      creditBalance: 0,
      billing: { status: 'PARTIAL', amount: 99 },
    });
    expect(result.items[0]).toMatchObject({ reversedByItemId: 'reversal' });
    expect(result.items[1]).toMatchObject({
      reversalOfItemId: 'original',
      reversalReason: 'Duplicate',
      reversedByUserId: 'user',
      reversedByUserName: 'Operator',
      reversedByUserEmail: 'operator@test.local',
    });
  });

  it('does not load a ledger from another account', async () => {
    const pg = {
      query: jest
        .fn()
        .mockResolvedValue([{ id: 'billing', account_id: 'other' }]),
    };
    const service = new BillingsService(
      pg as never,
      guidProvider as never,
      logger,
    );
    await expect(
      service.getLedger({ id: 'billing', accountId: 'account' }),
    ).rejects.toThrow('Billing not found');
    expect(pg.query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['open', 'OPEN'],
    ['partial', 'PARTIAL'],
    ['paid', 'PAID'],
    ['credit_balance', 'CREDIT_BALANCE'],
  ] as const)('filters %s by explicit status', async (status, expected) => {
    const pg = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]),
    };
    const service = new BillingsService(
      pg as never,
      guidProvider as never,
      logger,
    );
    await service.findAll({
      accountId: 'account',
      status,
      page: 1,
      perPage: 10,
    });
    expect(pg.query.mock.calls[0][0]).toContain(
      `billings.status = '${expected}'`,
    );
    expect(pg.query.mock.calls[1][0]).toContain(
      `billings.status = '${expected}'`,
    );
  });
});
