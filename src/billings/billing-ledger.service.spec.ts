import { LoggerService } from '@nestjs/common';
import { BillingLedgerService } from './billing-ledger.service';

describe('BillingLedgerService', () => {
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
      generate: jest.fn(() => 'generated-id'),
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
});
