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

  it('calculates ledger totals without original items that have reversal items', async () => {
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
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE reversals.reversal_of_item_id = billing_items.id',
      ),
      ['billing-id', 'account-id'],
    );
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
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
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
});
