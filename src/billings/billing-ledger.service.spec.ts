import { LoggerService } from '@nestjs/common';
import { BillingLedgerService } from './billing-ledger.service';

describe('BillingLedgerService', () => {
  const billing = {
    id: 'billing-id',
    account_id: 'account-id',
    client_id: 'client-id',
    payment_method: 'TO_RECEIVE',
    description: 'Fatura',
    amount: '100.00',
    amount_payed: '0.00',
    status: 'OPEN',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    payed_at: null,
  };
  const aClient = {
    id: 'client-id',
    account_id: 'account-id',
    name: 'Client Name',
  };
  const product = {
    id: 'product-id',
    account_id: 'account-id',
    name: 'Acai',
    price: 10,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };

  let postgresService: { getClient: jest.Mock };
  let client: { query: jest.Mock; release: jest.Mock };
  let guidProvider: { generate: jest.Mock };
  let logger: jest.Mocked<LoggerService>;
  let service: BillingLedgerService;

  beforeEach(() => {
    client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    postgresService = {
      getClient: jest.fn().mockResolvedValue(client),
    };
    guidProvider = {
      generate: jest
        .fn()
        .mockReturnValueOnce('billing-id')
        .mockReturnValueOnce('transaction-id')
        .mockReturnValueOnce('billing-item-id')
        .mockReturnValue('generated-id'),
    };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    service = new BillingLedgerService(
      postgresService as never,
      guidProvider,
      logger,
    );
  });

  it('commits and releases the client when the transaction succeeds', async () => {
    const result = await service.withTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases the client when the transaction fails', async () => {
    await expect(
      service.withTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('locks and returns the active billing for a client', async () => {
    const billing = {
      id: 'billing-id',
      account_id: 'account-id',
      client_id: 'client-id',
    };
    client.query.mockResolvedValueOnce({ rows: [billing] });

    const result = await service.getActiveBilling(
      { accountId: 'account-id', clientId: 'client-id' },
      client as never,
    );

    expect(result).toBe(billing);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("status IN ('OPEN', 'PARTIAL')"),
      ['account-id', 'client-id'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['account-id', 'client-id'],
    );
  });

  it('calculates effective totals excluding both sides of reversal pairs', async () => {
    client.query.mockResolvedValueOnce({
      rows: [{ debit_total: '150.00', credit_total: '40.00' }],
    });

    const totals = await service.calculateLedgerTotals(
      'billing-id',
      'account-id',
      client as never,
    );

    expect(totals).toEqual({
      debitTotal: 150,
      creditTotal: 40,
      openAmount: 110,
    });
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toContain('FROM billing_items');
    expect(sql).toContain('billing_items.reversal_of_item_id IS NULL');
    expect(sql).toContain(
      'NOT EXISTS (SELECT 1 FROM billing_items reversals WHERE reversals.reversal_of_item_id = billing_items.id)',
    );
    expect(params).toEqual(['billing-id', 'account-id']);
  });

  it('creates an open billing when the client has no active billing', async () => {
    const createdBilling = {
      ...billing,
      amount: '0.00',
      amount_payed: '0.00',
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [createdBilling] });

    const result = await service.createBilling({
      accountId: 'account-id',
      clientId: 'client-id',
      description: 'Fatura nova',
    });

    expect(result).toBe(createdBilling);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billings'),
      [
        'billing-id',
        'account-id',
        'client-id',
        'TO_RECEIVE',
        'Fatura nova',
        0,
        0,
        'OPEN',
      ],
    );
    const creationLog = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    expect(JSON.parse(creationLog[1][5])).toMatchObject({
      billingId: 'billing-id',
      before: null,
      after: { amount: '0.00' },
    });
    expect(
      client.query.mock.calls.find(([sql]) => sql.includes('FROM clients'))[0],
    ).toContain('FOR UPDATE');
  });

  it('rejects billing creation when the client already has an active billing', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [billing] });

    await expect(
      service.createBilling({
        accountId: 'account-id',
        clientId: 'client-id',
        description: 'Fatura nova',
      }),
    ).rejects.toMatchObject({
      response: {
        activeBillingId: 'billing-id',
      },
    });
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rejects billing creation when the client belongs to another account', async () => {
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ ...aClient, account_id: 'other-account-id' }],
    });

    await expect(
      service.createBilling({
        accountId: 'account-id',
        clientId: 'client-id',
        description: 'Fatura nova',
      }),
    ).rejects.toThrow('Client not found');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('adds a debit item and updates the billing projection', async () => {
    guidProvider.generate
      .mockReset()
      .mockReturnValueOnce('transaction-id')
      .mockReturnValueOnce('billing-item-id')
      .mockReturnValue('generated-id');
    const updatedBilling = {
      ...billing,
      amount: '150.00',
      status: 'OPEN',
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '150.00', credit_total: '0.00' }],
      })
      .mockResolvedValueOnce({ rows: [updatedBilling] });

    const result = await service.addDebit({
      accountId: 'account-id',
      billingId: 'billing-id',
      amount: 50,
      description: 'Debito manual',
      purchaseDate: '2026-10-06',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(result).toBe(updatedBilling);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      [
        'transaction-id',
        'account-id',
        'client-id',
        'Client Name',
        'Debito manual',
        'TO_RECEIVE',
        50,
        1,
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing_items'),
      [
        'billing-item-id',
        'billing-id',
        'transaction-id',
        'DEBIT',
        new Date('2026-10-06T12:00:00.000Z'),
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billings'),
      [150, 0, 'OPEN', null, expect.any(Date), 'billing-id', 'account-id'],
    );
    const debitLog = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    expect(debitLog[1].slice(1, 5)).toEqual([
      'account-id',
      'user-id',
      'User Name',
      'user@example.com',
    ]);
    expect(JSON.parse(debitLog[1][5])).toMatchObject({
      billingId: 'billing-id',
      billingItemId: 'billing-item-id',
      transactionId: 'transaction-id',
      before: { amount: '100.00' },
      after: { amount: '150.00' },
    });
  });

  it.each(['creation', 'debit'])(
    'rolls back %s when its audit log fails',
    async (action) => {
      client.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO logs')) throw new Error('audit failed');
        if (sql.includes('FROM clients')) return { rows: [aClient] };
        if (sql.includes('FROM billings') && sql.includes('status IN'))
          return { rows: [] };
        if (
          sql.includes('FROM billings') ||
          sql.includes('INSERT INTO billings') ||
          sql.includes('UPDATE billings')
        )
          return { rows: [billing] };
        if (sql.includes('AS debit_total'))
          return { rows: [{ debit_total: '150', credit_total: '0' }] };
        return { rows: [] };
      });
      const operation =
        action === 'creation'
          ? service.createBilling({
              accountId: 'account-id',
              clientId: 'client-id',
              description: 'Opening',
            })
          : service.addDebit({
              accountId: 'account-id',
              billingId: 'billing-id',
              amount: 50,
              description: 'Charge',
            });
      await expect(operation).rejects.toThrow('audit failed');
      expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
      expect(client.query.mock.calls.map(([sql]) => sql)).not.toContain(
        'COMMIT',
      );
      expect(client.release).toHaveBeenCalledTimes(1);
    },
  );

  it.each([0, -1, 1.234, Number.NaN])(
    'rejects invalid credit amount %s before writes',
    async (amount) => {
      await expect(
        service.addCredit({
          accountId: 'account-id',
          billingId: 'billing-id',
          amount,
          paymentMethod: 'PIX',
          userId: 'user',
          userName: 'Operator',
          userEmail: 'operator@test.local',
        }),
      ).rejects.toThrow('Credit amount must be greater than zero');
      expect(postgresService.getClient).not.toHaveBeenCalled();
    },
  );

  it('rejects a receivable payment method for credits', async () => {
    await expect(
      service.addCredit({
        accountId: 'account-id',
        billingId: 'billing-id',
        amount: 10,
        paymentMethod: 'TO_RECEIVE',
        userId: 'user',
        userName: 'Operator',
        userEmail: 'operator@test.local',
      }),
    ).rejects.toThrow('Invalid credit payment method');
    expect(postgresService.getClient).not.toHaveBeenCalled();
  });

  it('rolls back debit creation when a transaction insert fails', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockRejectedValueOnce(new Error('insert failed'));

    await expect(
      service.addDebit({
        accountId: 'account-id',
        billingId: 'billing-id',
        amount: 50,
        description: 'Debito manual',
      }),
    ).rejects.toThrow('insert failed');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('adds a partial credit and logs the billing change', async () => {
    guidProvider.generate
      .mockReset()
      .mockReturnValueOnce('transaction-id')
      .mockReturnValueOnce('billing-item-id')
      .mockReturnValueOnce('log-id')
      .mockReturnValue('generated-id');
    const updatedBilling = {
      ...billing,
      amount: '60.00',
      amount_payed: '40.00',
      status: 'PARTIAL',
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100.00', credit_total: '40.00' }],
      })
      .mockResolvedValueOnce({ rows: [updatedBilling] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.addCredit({
      accountId: 'account-id',
      billingId: 'billing-id',
      amount: 40,
      paymentMethod: 'PIX',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(result).toBe(updatedBilling);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      [
        'transaction-id',
        'account-id',
        'client-id',
        'Client Name',
        'Crédito de R$ 40.00',
        'PIX',
        40,
        1,
        expect.any(Date),
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing_items'),
      [
        'billing-item-id',
        'billing-id',
        'transaction-id',
        'CREDIT',
        expect.any(Date),
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billings'),
      [60, 40, 'PARTIAL', null, expect.any(Date), 'billing-id', 'account-id'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO logs'),
      [
        'log-id',
        'account-id',
        'user-id',
        'User Name',
        'user@example.com',
        expect.any(String),
        'billing_credit',
        null,
      ],
    );
  });

  it('closes the billing when credit equals the open amount', async () => {
    const paidBilling = {
      ...billing,
      amount: '0.00',
      amount_payed: '100.00',
      status: 'PAID',
      payed_at: new Date('2026-10-06T12:00:00.000Z'),
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100.00', credit_total: '100.00' }],
      })
      .mockResolvedValueOnce({ rows: [paidBilling] })
      .mockResolvedValueOnce({ rows: [] });

    await service.addCredit({
      accountId: 'account-id',
      billingId: 'billing-id',
      amount: 100,
      paymentMethod: 'PIX',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billings'),
      [
        0,
        100,
        'PAID',
        expect.any(Date),
        expect.any(Date),
        'billing-id',
        'account-id',
      ],
    );
  });

  it('stores overpayment as credit balance without keeping an active billing', async () => {
    const creditBalanceBilling = {
      ...billing,
      amount: '0.00',
      amount_payed: '120.00',
      status: 'CREDIT_BALANCE',
      payed_at: new Date('2026-10-06T12:00:00.000Z'),
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100.00', credit_total: '120.00' }],
      })
      .mockResolvedValueOnce({ rows: [creditBalanceBilling] })
      .mockResolvedValueOnce({ rows: [] });

    await service.addCredit({
      accountId: 'account-id',
      billingId: 'billing-id',
      amount: 120,
      paymentMethod: 'PIX',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billings'),
      [
        0,
        120,
        'CREDIT_BALANCE',
        expect.any(Date),
        expect.any(Date),
        'billing-id',
        'account-id',
      ],
    );
  });

  it('rejects a credit amount that is not greater than zero', async () => {
    await expect(
      service.addCredit({
        accountId: 'account-id',
        billingId: 'billing-id',
        amount: 0,
        paymentMethod: 'PIX',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Credit amount must be greater than zero');

    expect(postgresService.getClient).not.toHaveBeenCalled();
  });

  it('rejects credit against a paid billing', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...billing, status: 'PAID' }] });

    await expect(
      service.addCredit({
        accountId: 'account-id',
        billingId: 'billing-id',
        amount: 10,
        paymentMethod: 'PIX',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Billing is not open or partial');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rolls back credit when the audit log insert fails', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100.00', credit_total: '40.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...billing, amount: '60.00', status: 'PARTIAL' }],
      })
      .mockRejectedValueOnce(new Error('log failed'));

    await expect(
      service.addCredit({
        accountId: 'account-id',
        billingId: 'billing-id',
        amount: 40,
        paymentMethod: 'PIX',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('log failed');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('adds a sale to an active billing with receivable transactions', async () => {
    guidProvider.generate
      .mockReset()
      .mockReturnValueOnce('transaction-id')
      .mockReturnValueOnce('billing-item-id')
      .mockReturnValueOnce('log-id')
      .mockReturnValue('generated-id');
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [product] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '120.00', credit_total: '0.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...billing, amount: '120.00', status: 'OPEN' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.addSale({
      accountId: 'account-id',
      billingId: 'billing-id',
      items: [{ productId: 'product-id', price: 10, quantity: 2 }],
      buyDate: '2026-10-06',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(result.amount).toBe('120.00');
    const saleLog = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    expect(saleLog[1].slice(1, 5)).toEqual([
      'account-id',
      'user-id',
      'User Name',
      'user@example.com',
    ]);
    expect(saleLog[1][6]).toBe('billing_sale');
    expect(JSON.parse(saleLog[1][5])).toEqual({
      billingId: 'billing-id',
      transactionIds: ['transaction-id'],
      billingItemIds: ['billing-item-id'],
      before: { amount: 100, amountPayed: 0, status: 'OPEN' },
      after: { amount: 120, amountPayed: 0, status: 'OPEN' },
    });
    expect(
      client.query.mock.calls.find(([sql]) => sql.includes('FROM billings'))[0],
    ).toContain('FOR UPDATE');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      [
        'transaction-id',
        'account-id',
        'client-id',
        'product-id',
        'Client Name',
        '2 x R$ 10 - Acai',
        'TO_RECEIVE',
        20,
        2,
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing_items'),
      [
        'billing-item-id',
        'billing-id',
        'transaction-id',
        'DEBIT',
        new Date('2026-10-06T12:00:00.000Z'),
      ],
    );
  });

  it('creates an active billing in the same transaction when sale client has none', async () => {
    guidProvider.generate
      .mockReset()
      .mockReturnValueOnce('billing-id')
      .mockReturnValueOnce('transaction-id')
      .mockReturnValueOnce('billing-item-id')
      .mockReturnValueOnce('log-id')
      .mockReturnValue('generated-id');
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [product] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '20.00', credit_total: '0.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...billing, amount: '20.00', status: 'OPEN' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.addSale({
      accountId: 'account-id',
      clientId: 'client-id',
      items: [{ productId: 'product-id', price: 10, quantity: 2 }],
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billings'),
      [
        'billing-id',
        'account-id',
        'client-id',
        'TO_RECEIVE',
        expect.stringContaining('Fatura mes:'),
        0,
        0,
        'OPEN',
      ],
    );
  });

  it.each(['debit', 'credit', 'sale', 'reversal'])(
    'rejects a foreign account billing for %s without writes',
    async (operation) => {
      client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
        rows: [{ ...billing, account_id: 'other-account' }],
      });
      const identity = {
        accountId: 'account-id',
        billingId: 'billing-id',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      };
      const result =
        operation === 'debit'
          ? service.addDebit({ ...identity, amount: 10, description: 'Charge' })
          : operation === 'credit'
            ? service.addCredit({
                ...identity,
                amount: 10,
                paymentMethod: 'PIX',
              })
            : operation === 'sale'
              ? service.addSale({
                  ...identity,
                  items: [{ productId: 'product-id', quantity: 1, price: 10 }],
                })
              : service.reverseItem({
                  ...identity,
                  itemId: 'item',
                  reason: 'Correction',
                });
      await expect(result).rejects.toMatchObject({ status: 404 });
      expect(
        client.query.mock.calls.some(([sql]) =>
          /^\s*(INSERT|UPDATE|DELETE)\b/.test(sql),
        ),
      ).toBe(false);
      expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    },
  );

  it('rejects debit against a paid billing with HTTP 400 without writes', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...billing, status: 'PAID' }] })
      .mockResolvedValueOnce({ rows: [aClient] });
    await expect(
      service.addDebit({
        accountId: 'account-id',
        billingId: 'billing-id',
        amount: 10,
        description: 'Charge',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      client.query.mock.calls.some(([sql]) =>
        /^\s*(INSERT|UPDATE|DELETE)\b/.test(sql),
      ),
    ).toBe(false);
  });

  it.each([1.5, 0])(
    'rejects invalid sale quantity %s before a transaction',
    async (quantity) => {
      await expect(
        service.addSale({
          accountId: 'account-id',
          billingId: 'billing-id',
          userId: 'user',
          userName: 'Operator',
          userEmail: 'operator@test.local',
          items: [{ productId: 'product-id', quantity, price: 10 }],
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(postgresService.getClient).not.toHaveBeenCalled();
    },
  );

  it('creates a billing with an initial debit and audits its user', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clients')) return { rows: [aClient] };
      if (sql.includes('FROM billings')) return { rows: [] };
      if (sql.includes('INSERT INTO billings'))
        return { rows: [{ ...billing, amount: '0.00' }] };
      if (sql.includes('AS debit_total'))
        return { rows: [{ debit_total: '25', credit_total: '0' }] };
      if (sql.includes('UPDATE billings'))
        return { rows: [{ ...billing, amount: '25.00' }] };
      return { rows: [] };
    });
    const result = await service.createBilling({
      accountId: 'account-id',
      clientId: 'client-id',
      description: 'Opening',
      amount: 25,
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });
    expect(result).toMatchObject({ amount: '25.00', status: 'OPEN' });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      [
        'transaction-id',
        'account-id',
        'client-id',
        'Client Name',
        'Opening',
        'TO_RECEIVE',
        25,
        1,
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing_items'),
      [
        'billing-item-id',
        'billing-id',
        'transaction-id',
        'DEBIT',
        expect.any(Date),
      ],
    );
    const logs = client.query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    expect(logs.map(([, params]) => params[6])).toEqual([
      'billing_debit',
      'billing_created',
    ]);
    expect(
      logs.every(
        ([, params]) =>
          params[2] === 'user-id' &&
          params[3] === 'User Name' &&
          params[4] === 'user@example.com',
      ),
    ).toBe(true);
  });

  it('rolls back a sale when audit insertion fails', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO logs'))
        throw new Error('sale audit failed');
      if (sql.includes('FROM billings') || sql.includes('UPDATE billings'))
        return { rows: [billing] };
      if (sql.includes('FROM clients')) return { rows: [aClient] };
      if (sql.includes('FROM products')) return { rows: [product] };
      if (sql.includes('AS debit_total'))
        return { rows: [{ debit_total: '120', credit_total: '0' }] };
      return { rows: [] };
    });
    await expect(
      service.addSale({
        accountId: 'account-id',
        billingId: 'billing-id',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
        items: [{ productId: 'product-id', price: 10, quantity: 2 }],
      }),
    ).rejects.toThrow('sale audit failed');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
    expect(client.query.mock.calls.map(([sql]) => sql)).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('locks the credit target before any financial insert', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100', credit_total: '10' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...billing, amount: '90', status: 'PARTIAL' }],
      });
    await service.addCredit({
      accountId: 'account-id',
      billingId: 'billing-id',
      amount: 10,
      paymentMethod: 'PIX',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[1][1]).toEqual(['billing-id']);
    expect(
      client.query.mock.calls.findIndex(([sql]) =>
        sql.includes('INSERT INTO transactions'),
      ),
    ).toBeGreaterThan(1);
  });

  it('rejects sale against a paid billing', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...billing, status: 'PAID' }] })
      .mockResolvedValueOnce({ rows: [aClient] });

    await expect(
      service.addSale({
        accountId: 'account-id',
        billingId: 'billing-id',
        items: [{ productId: 'product-id', price: 10, quantity: 2 }],
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Billing is not open or partial');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rejects sale when the product belongs to another account', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({
        rows: [{ ...product, account_id: 'other-account-id' }],
      });

    await expect(
      service.addSale({
        accountId: 'account-id',
        billingId: 'billing-id',
        items: [{ productId: 'product-id', price: 10, quantity: 2 }],
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Product not found');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rejects sale items with invalid quantity or price before opening a transaction', async () => {
    await expect(
      service.addSale({
        accountId: 'account-id',
        billingId: 'billing-id',
        items: [{ productId: 'product-id', price: 10, quantity: 0 }],
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Sale item quantity must be greater than zero');

    await expect(
      service.addSale({
        accountId: 'account-id',
        billingId: 'billing-id',
        items: [{ productId: 'product-id', price: 0, quantity: 1 }],
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Sale item price must be greater than zero');
    expect(postgresService.getClient).not.toHaveBeenCalled();
  });

  it('rolls back sale when billing item insert fails', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [aClient] })
      .mockResolvedValueOnce({ rows: [product] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('item insert failed'));

    await expect(
      service.addSale({
        accountId: 'account-id',
        billingId: 'billing-id',
        items: [{ productId: 'product-id', price: 10, quantity: 2 }],
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('item insert failed');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('reverses a debit item with a credit reversal and logs the change', async () => {
    guidProvider.generate
      .mockReset()
      .mockReturnValueOnce('reversal-transaction-id')
      .mockReturnValueOnce('reversal-item-id')
      .mockReturnValueOnce('log-id')
      .mockReturnValue('generated-id');
    const debitItem = {
      id: 'billing-item-id',
      transaction_id: 'transaction-id',
      type: 'DEBIT',
      reversal_of_item_id: null,
      amount: '100.00',
      client_id: 'client-id',
      client_name: 'Client Name',
      description: 'Compra',
      payment_method: 'TO_RECEIVE',
    };
    const updatedBilling = {
      ...billing,
      amount: '0.00',
      amount_payed: '0.00',
      status: 'OPEN',
      payed_at: null,
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [debitItem] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '0.00', credit_total: '0.00' }],
      })
      .mockResolvedValueOnce({ rows: [updatedBilling] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.reverseItem({
      accountId: 'account-id',
      billingId: 'billing-id',
      itemId: 'billing-item-id',
      reason: 'Produto cancelado',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(result).toBe(updatedBilling);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billings'),
      [0, 0, 'OPEN', null, expect.any(Date), 'billing-id', 'account-id'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      [
        'reversal-transaction-id',
        'account-id',
        'client-id',
        'Client Name',
        'Estorno: Compra',
        'TO_RECEIVE',
        100,
        1,
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing_items'),
      [
        'reversal-item-id',
        'billing-id',
        'reversal-transaction-id',
        'CREDIT',
        expect.any(Date),
        'billing-item-id',
        'Produto cancelado',
        expect.any(Date),
        'user-id',
        'User Name',
        'user@example.com',
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO logs'),
      [
        'log-id',
        'account-id',
        'user-id',
        'User Name',
        'user@example.com',
        expect.any(String),
        'billing_item_reversal',
        null,
      ],
    );
  });

  it('reverses a credit item with a debit reversal', async () => {
    guidProvider.generate
      .mockReset()
      .mockReturnValueOnce('reversal-transaction-id')
      .mockReturnValueOnce('reversal-item-id')
      .mockReturnValueOnce('log-id')
      .mockReturnValue('generated-id');
    const creditItem = {
      id: 'credit-item-id',
      transaction_id: 'credit-transaction-id',
      type: 'CREDIT',
      reversal_of_item_id: null,
      amount: '40.00',
      client_id: 'client-id',
      client_name: 'Client Name',
      description: 'Pagamento',
      payment_method: 'PIX',
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [creditItem] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100.00', credit_total: '0.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...billing, amount: '100.00', status: 'OPEN' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await service.reverseItem({
      accountId: 'account-id',
      billingId: 'billing-id',
      itemId: 'credit-item-id',
      reason: 'Pagamento errado',
      userId: 'user-id',
      userName: 'User Name',
      userEmail: 'user@example.com',
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      [
        'reversal-transaction-id',
        'account-id',
        'client-id',
        'Client Name',
        'Estorno: Pagamento',
        'PIX',
        40,
        1,
      ],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE billings'),
      [100, 0, 'OPEN', null, expect.any(Date), 'billing-id', 'account-id'],
    );

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing_items'),
      [
        'reversal-item-id',
        'billing-id',
        'reversal-transaction-id',
        'DEBIT',
        expect.any(Date),
        'credit-item-id',
        'Pagamento errado',
        expect.any(Date),
        'user-id',
        'User Name',
        'user@example.com',
      ],
    );
  });

  it('rejects reversal with a blank reason before opening a transaction', async () => {
    await expect(
      service.reverseItem({
        accountId: 'account-id',
        billingId: 'billing-id',
        itemId: 'billing-item-id',
        reason: '   ',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Reversal reason is required');
    expect(postgresService.getClient).not.toHaveBeenCalled();
  });

  it('rejects duplicate item reversal with conflict details', async () => {
    const debitItem = {
      id: 'billing-item-id',
      transaction_id: 'transaction-id',
      type: 'DEBIT',
      reversal_of_item_id: null,
      amount: '100.00',
      client_id: 'client-id',
      client_name: 'Client Name',
      description: 'Compra',
      payment_method: 'TO_RECEIVE',
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [debitItem] })
      .mockResolvedValueOnce({ rows: [{ id: 'existing-reversal-id' }] });

    await expect(
      service.reverseItem({
        accountId: 'account-id',
        billingId: 'billing-id',
        itemId: 'billing-item-id',
        reason: 'Duplicado',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toMatchObject({
      response: {
        reversalItemId: 'existing-reversal-id',
      },
    });
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rejects reversal for an item outside the account', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      service.reverseItem({
        accountId: 'account-id',
        billingId: 'billing-id',
        itemId: 'other-item-id',
        reason: 'Conta errada',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Billing item not found');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rejects reversal against a paid billing', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...billing, status: 'PAID' }] });

    await expect(
      service.reverseItem({
        accountId: 'account-id',
        billingId: 'billing-id',
        itemId: 'billing-item-id',
        reason: 'Fatura paga',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('Billing is not open or partial');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });

  it('rolls back reversal when the audit log insert fails', async () => {
    const debitItem = {
      id: 'billing-item-id',
      transaction_id: 'transaction-id',
      type: 'DEBIT',
      reversal_of_item_id: null,
      amount: '100.00',
      client_id: 'client-id',
      client_name: 'Client Name',
      description: 'Compra',
      payment_method: 'TO_RECEIVE',
    };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [billing] })
      .mockResolvedValueOnce({ rows: [debitItem] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ debit_total: '100.00', credit_total: '100.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...billing, amount: '0.00', status: 'PAID' }],
      })
      .mockRejectedValueOnce(new Error('log failed'));

    await expect(
      service.reverseItem({
        accountId: 'account-id',
        billingId: 'billing-id',
        itemId: 'billing-item-id',
        reason: 'Falha no log',
        userId: 'user-id',
        userName: 'User Name',
        userEmail: 'user@example.com',
      }),
    ).rejects.toThrow('log failed');
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('ROLLBACK');
  });
});
