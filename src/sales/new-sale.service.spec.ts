import { LoggerService } from '@nestjs/common';
import { BillingItemTypeEnum } from 'src/billings/entities/billing-item-type.vo';
import { GuidProvider } from 'src/libs/src/guid/contract/guid-provider.interface';
import { Transaction } from 'src/transactions/entities/transaction.entity';
import { TransactionsRepository } from 'src/transactions/repository/transactions-repository.interface';
import { NewSaleService } from './new-sale.service';

describe('NewSaleService', () => {
  const product = {
    id: 'product-id',
    account_id: 'account-id',
    name: 'Acai',
    price: 10,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
  const client = {
    name: 'Client Name',
    account_id: 'account-id',
  };
  const saleInput = {
    accountId: 'account-id',
    userId: 'user-id',
    userName: 'User Name',
    userEmail: 'user@example.com',
    clientId: 'client-id',
    paymentMethod: 'PIX',
    buyDate: '2026-08-29',
    items: [
      {
        productId: 'product-id',
        price: 10,
        quantity: 2,
      },
    ],
  };

  let postgresService: { query: jest.Mock };
  let transactionRepository: jest.Mocked<TransactionsRepository>;
  let guidProvider: jest.Mocked<GuidProvider>;
  let logger: jest.Mocked<LoggerService>;
  let service: NewSaleService;

  beforeEach(() => {
    postgresService = {
      query: jest.fn((sql: string) => {
        if (sql.includes('SELECT * FROM products')) {
          return Promise.resolve([product]);
        }
        if (sql.includes('SELECT name,account_id FROM clients')) {
          return Promise.resolve([client]);
        }
        if (sql.includes('SELECT id,account_id,amount,amount_payed FROM billings')) {
          return Promise.resolve([]);
        }
        if (sql.includes('INSERT INTO billings')) {
          return Promise.resolve([{ id: 'billing-id' }]);
        }
        return Promise.resolve([]);
      }),
    };
    transactionRepository = {
      save: jest.fn((transaction: Transaction) =>
        Promise.resolve(
          Transaction.getInstance({
            id: 'transaction-id',
            account_id: transaction.getAccountId(),
            client_id: transaction.getClientId(),
            product_id: transaction.getProductId(),
            client_name: transaction.getClientName(),
            description: transaction.getDescription(),
            payment_method: transaction.getPaymentMethod(),
            amount: transaction.getAmount(),
            quantity: transaction.getQuantity(),
            payed_at: transaction.getPayedAt(),
            created_at: new Date('2026-08-29T12:00:00.000Z'),
            updated_at: new Date('2026-08-29T12:00:00.000Z'),
          }),
        ),
      ),
    };
    guidProvider = {
      generate: jest.fn(() => 'generated-id'),
    };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    service = new NewSaleService(
      postgresService as never,
      transactionRepository,
      guidProvider,
      logger,
    );
  });

  it('inserts a create_sale log for paid sales without billing', async () => {
    await service.execute(saleInput);

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
      'create_sale',
      null,
    ]);

    const data = JSON.parse(logInsert[1][5]);
    expect(data.billing).toEqual({ action: 'none' });
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toEqual(
      expect.objectContaining({
        id: 'transaction-id',
        clientId: 'client-id',
        clientName: 'Client Name',
        productId: 'product-id',
        paymentMethod: 'PIX',
        amount: 20,
        quantity: 2,
      }),
    );
  });

  it('inserts a create_sale log with created billing data for receivable sales', async () => {
    await service.execute({
      ...saleInput,
      paymentMethod: 'TO_RECEIVE',
    });

    expect(postgresService.query).toHaveBeenCalledWith(
      'INSERT INTO billing_items (id, billing_id, transaction_id, type, purchased_at) VALUES ($1, $2, $3, $4, $5)',
      [
        'generated-id',
        'billing-id',
        'transaction-id',
        BillingItemTypeEnum.DEBIT,
        '2026-08-29T12:00:00.000Z',
      ],
    );

    const logInsert = postgresService.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO logs'),
    );
    const data = JSON.parse(logInsert[1][5]);

    expect(data.billing).toEqual({
      action: 'created',
      id: 'billing-id',
      amount: 20,
    });
  });

  it('does not fail the sale when create_sale log insertion fails', async () => {
    postgresService.query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM products')) {
        return Promise.resolve([product]);
      }
      if (sql.includes('SELECT name,account_id FROM clients')) {
        return Promise.resolve([client]);
      }
      if (sql.includes('INSERT INTO logs')) {
        return Promise.reject(new Error('log insert failed'));
      }
      return Promise.resolve([]);
    });

    await expect(service.execute(saleInput)).resolves.toEqual(
      expect.objectContaining({
        id: 'transaction-id',
        clientName: 'Client Name',
        paymentMethod: 'PIX',
        amount: 20,
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to insert create_sale log for user user-id',
      expect.any(Error),
    );
  });
});
