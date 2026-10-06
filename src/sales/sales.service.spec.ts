import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PostgresService } from 'src/postgres/postgres.service';

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PostgresService, useValue: { query: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it.each(['DEBIT', 'CREDIT'])(
    'preserves ledger-linked %s sales and requires invoice reversal',
    async (type) => {
      const pg = {
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'sale', account_id: 'account' }])
          .mockResolvedValueOnce([{ id: 'item', billing_id: 'billing', type }]),
      };
      const service = new SalesService(pg as never);
      await expect(
        service.remove({ id: 'sale', accountId: 'account' }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Use o estorno na fatura para corrigir uma venda vinculada.',
      });
      expect(
        pg.query.mock.calls.every(([sql]) => sql.trim().startsWith('SELECT')),
      ).toBe(true);
    },
  );

  it('keeps deleting paid sales that are not linked to a billing', async () => {
    const pg = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'sale', account_id: 'account' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
    };
    await new SalesService(pg as never).remove({
      id: 'sale',
      accountId: 'account',
    });
    expect(pg.query).toHaveBeenCalledWith(
      'DELETE FROM transactions WHERE id = $1',
      ['sale'],
    );
  });
});
