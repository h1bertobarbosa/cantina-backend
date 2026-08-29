import { LoggerService, NotFoundException } from '@nestjs/common';
import BillingFacade from './facades/billing.facade';
import PayBillingService from './pay-billing.service';

describe('PayBillingService', () => {
  const billing = {
    id: 'billing-id',
    account_id: 'account-id',
    client_id: 'client-id',
    payment_method: 'TO_RECEIVE',
    description: 'Fatura teste',
    amount: '100.00',
    amount_payed: '0.00',
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    payed_at: null,
  };
  const client = {
    name: 'Client Name',
    account_id: 'account-id',
  };
  const payBillingInput = {
    accountId: 'account-id',
    billingId: 'billing-id',
    userId: 'user-id',
    userName: 'User Name',
    userEmail: 'user@example.com',
    amount: 50,
    paymentMethod: 'PIX',
  };

  let postgresService: { query: jest.Mock };
  let payBillingFacade: jest.Mocked<
    Pick<
      BillingFacade,
      | 'payBillingAmounEqualTotal'
      | 'payPartialAmount'
      | 'generateNewBilling'
      | 'generateCreditTransaction'
      | 'generateBillingItems'
    >
  >;
  let guidProvider: { generate: jest.Mock };
  let logger: jest.Mocked<LoggerService>;
  let service: PayBillingService;

  beforeEach(() => {
    postgresService = {
      query: jest.fn((sql: string) => {
        if (sql.includes('SELECT * FROM billings')) {
          return Promise.resolve([billing]);
        }
        if (sql.includes('SELECT name,account_id FROM clients')) {
          return Promise.resolve([client]);
        }
        return Promise.resolve([]);
      }),
    };
    payBillingFacade = {
      payBillingAmounEqualTotal: jest.fn().mockResolvedValue(undefined),
      payPartialAmount: jest.fn().mockResolvedValue(undefined),
      generateNewBilling: jest.fn(),
      generateCreditTransaction: jest.fn(),
      generateBillingItems: jest.fn(),
    };
    guidProvider = {
      generate: jest.fn(() => 'generated-id'),
    };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    service = new PayBillingService(
      postgresService as never,
      payBillingFacade as never,
      guidProvider as never,
      logger,
    );
  });

  it('inserts a pay_billing log for partial payments', async () => {
    await service.execute(payBillingInput);

    expect(payBillingFacade.payPartialAmount).toHaveBeenCalled();

    const logInsert = postgresService.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );

    expect(logInsert).toBeDefined();
    expect(logInsert[1]).toEqual([
      'generated-id',
      'account-id',
      'user-id',
      'User Name',
      'user@example.com',
      expect.any(String),
      'pay_billing',
      null,
    ]);

    const data = JSON.parse(logInsert[1][5]);
    expect(data.billing).toEqual(
      expect.objectContaining({
        id: 'billing-id',
        clientId: 'client-id',
        clientName: 'Client Name',
        amountBefore: 100,
        amountPayedBefore: 0,
        amountPayedInput: 50,
        amountAfter: 50,
        amountPayedAfter: 50,
        paymentMethodBefore: 'TO_RECEIVE',
        paymentMethodInput: 'PIX',
        status: 'partial',
        amountDifference: 50,
      }),
    );
  });

  it('inserts a pay_billing log for total payments', async () => {
    await service.execute({
      ...payBillingInput,
      amount: 100,
    });

    expect(payBillingFacade.payBillingAmounEqualTotal).toHaveBeenCalled();

    const logInsert = postgresService.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    const data = JSON.parse(logInsert[1][5]);

    expect(data.billing).toEqual(
      expect.objectContaining({
        status: 'paid',
        amountDifference: 0,
        amountAfter: 0,
        amountPayedInput: 100,
      }),
    );
  });

  it('inserts a pay_billing log for overpaid payments', async () => {
    const newBilling = {
      setClienteName: jest.fn(),
    };
    const transaction = {};
    payBillingFacade.generateNewBilling.mockResolvedValue(newBilling as never);
    payBillingFacade.generateCreditTransaction.mockResolvedValue(
      transaction as never,
    );
    payBillingFacade.generateBillingItems.mockResolvedValue(undefined);

    await service.execute({
      ...payBillingInput,
      amount: 120,
    });

    expect(payBillingFacade.generateNewBilling).toHaveBeenCalledWith({
      accountId: 'account-id',
      clientId: 'client-id',
      amount: 0,
      amountPayed: 20,
      paymentMethod: 'TO_RECEIVE',
    });

    const logInsert = postgresService.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    const data = JSON.parse(logInsert[1][5]);

    expect(data.billing).toEqual(
      expect.objectContaining({
        status: 'overpaid',
        amountDifference: -20,
        amountAfter: 0,
        amountPayedInput: 120,
      }),
    );
  });

  it('does not fail payment when pay_billing log insertion fails', async () => {
    postgresService.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM billings')) {
        return Promise.resolve([billing]);
      }
      if (sql.includes('SELECT name,account_id FROM clients')) {
        return Promise.resolve([client]);
      }
      if (sql.includes('INSERT INTO logs')) {
        return Promise.reject(new Error('log insert failed'));
      }
      return Promise.resolve([]);
    });

    await expect(service.execute(payBillingInput)).resolves.toEqual(
      expect.objectContaining({
        id: 'billing-id',
        clientId: 'client-id',
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to insert pay_billing log for user user-id',
      expect.any(Error),
    );
  });

  it('throws NotFoundException when billing does not exist', async () => {
    postgresService.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM billings')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    await expect(service.execute(payBillingInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(payBillingFacade.payPartialAmount).not.toHaveBeenCalled();
    expect(payBillingFacade.payBillingAmounEqualTotal).not.toHaveBeenCalled();
    expect(
      postgresService.query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO logs'),
      ),
    ).toBe(false);
  });

  it('throws NotFoundException when billing belongs to another account', async () => {
    postgresService.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM billings')) {
        return Promise.resolve([
          {
            ...billing,
            account_id: 'another-account-id',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    await expect(service.execute(payBillingInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(payBillingFacade.payPartialAmount).not.toHaveBeenCalled();
    expect(payBillingFacade.payBillingAmounEqualTotal).not.toHaveBeenCalled();
    expect(
      postgresService.query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO logs'),
      ),
    ).toBe(false);
  });
});
