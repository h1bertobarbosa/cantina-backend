import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let postgresService: { query: jest.Mock };

  beforeEach(() => {
    postgresService = {
      query: jest.fn(),
    };
    service = new DashboardService(postgresService as any);
  });

  const mockSummaryQueries = () => {
    postgresService.query
      .mockResolvedValueOnce([{ total: '2142.00' }])
      .mockResolvedValueOnce([{ total: '2142.00' }])
      .mockResolvedValueOnce([{ total: '22014.00' }])
      .mockResolvedValueOnce([{ total: '24065.00' }])
      .mockResolvedValueOnce([{ total: '1307' }])
      .mockResolvedValueOnce([{ total: '276' }])
      .mockResolvedValueOnce([{ total: '26' }]);
  };

  it('sums only unpaid billings for receivable totals', async () => {
    mockSummaryQueries();

    const summary = await service.getSummary({ accountId: 'account-1' });

    expect(summary).toEqual({
      totalReceivablePeriod: 2142,
      totalReceivableAllTime: 2142,
      totalReceivedPeriod: 22014,
      grossSalesPeriod: 24065,
      salesCountPeriod: 1307,
      clientsCount: 276,
      productsCount: 26,
    });
    expect(postgresService.query.mock.calls[0][0]).toContain(
      'AND billings.payed_at IS NULL',
    );
    expect(postgresService.query.mock.calls[1][0]).toContain(
      'AND payed_at IS NULL',
    );
  });

  it('passes selected date boundaries to period queries without changing the day', async () => {
    mockSummaryQueries();

    await service.getSummary({
      accountId: 'account-1',
      startDate: '2026-07-22',
      endDate: '2026-07-22',
    });

    expect(postgresService.query.mock.calls[0][1]).toEqual([
      'account-1',
      '2026-07-22 00:00:00',
      '2026-07-22 23:59:59',
    ]);
    expect(postgresService.query.mock.calls[2][1]).toEqual([
      'account-1',
      '2026-07-22 00:00:00',
      '2026-07-22 23:59:59',
    ]);
  });
});
