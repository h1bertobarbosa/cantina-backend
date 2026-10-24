import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserSession } from 'src/signin/decorators/user.decorator';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: { getTotalSales: jest.Mock; getSummary: jest.Mock };

  const user = {
    sub: 'user-1',
    accountId: 'account-1',
    email: 'user@test.local',
    name: 'User',
  } as UserSession;

  beforeEach(async () => {
    dashboardService = {
      getTotalSales: jest.fn(),
      getSummary: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('getTotalSales merges accountId from the session into the query', async () => {
    dashboardService.getTotalSales.mockResolvedValue({ total: 100 });
    const query = {
      paymentMethod: 'TO_RECEIVE',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };

    const result = await controller.getTotalSales(user, query as any);

    expect(dashboardService.getTotalSales).toHaveBeenCalledWith({
      ...query,
      accountId: 'account-1',
    });
    expect(result).toEqual({ total: 100 });
  });

  it('getSummary merges accountId from the session into the query', async () => {
    dashboardService.getSummary.mockResolvedValue({ salesCountPeriod: 10 });
    const query = { paymentMethod: 'TO_RECEIVE' };

    const result = await controller.getSummary(user, query as any);

    expect(dashboardService.getSummary).toHaveBeenCalledWith({
      ...query,
      accountId: 'account-1',
    });
    expect(result).toEqual({ salesCountPeriod: 10 });
  });
});
