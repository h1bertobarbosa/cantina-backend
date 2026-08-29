import { ForbiddenException } from '@nestjs/common';
import { PostgresService } from 'src/postgres/postgres.service';
import { QueryLogDto } from './dto/query-log.dto';
import { AUDIT_ALLOWED_EMAIL, LogsService } from './logs.service';

describe('LogsService', () => {
  let postgresService: jest.Mocked<PostgresService>;
  let service: LogsService;

  beforeEach(() => {
    postgresService = {
      query: jest.fn(),
    } as unknown as jest.Mocked<PostgresService>;
    service = new LogsService(postgresService);
  });

  it('returns logs for the authorized audit email without tenant filter', async () => {
    postgresService.query
      .mockResolvedValueOnce([
        {
          id: 'log-1',
          account_id: 'account-a',
          user_id: 'user-1',
          user_name: 'Humberto Barbosa',
          user_email: AUDIT_ALLOWED_EMAIL,
          data: { billing: { id: 'billing-1' } },
          log_type: 'pay_billing',
          obs: null,
          created_at: new Date('2026-08-29T20:05:48.088Z'),
        },
      ] as any)
      .mockResolvedValueOnce([{ count: '1' }] as any);

    const result = await service.findAll(
      new QueryLogDto({ page: 1, perPage: 10 }),
      AUDIT_ALLOWED_EMAIL,
    );

    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'log-1',
      account_id: 'account-a',
      log_type: 'pay_billing',
    });
    expect(postgresService.query).toHaveBeenNthCalledWith(
      1,
      expect.not.stringContaining('account_id ='),
      [10, 0],
    );
  });

  it('denies users different from the authorized audit email', async () => {
    await expect(
      service.findAll(new QueryLogDto({}), 'other@example.com'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(postgresService.query).not.toHaveBeenCalled();
  });

  it('uses parameterized filters and allowlisted ordering', async () => {
    postgresService.query
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ count: '0' }] as any);

    await service.findAll(
      new QueryLogDto({
        logType: 'create_sale',
        userEmail: 'humberto',
        search: 'Mousse',
        orderBy: 'data; drop table logs;',
        orderDir: 'asc',
        page: 2,
        perPage: 20,
      }),
      AUDIT_ALLOWED_EMAIL,
    );

    expect(postgresService.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ORDER BY created_at ASC'),
      ['create_sale', '%humberto%', '%Mousse%', 20, 20],
    );
    expect(postgresService.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('COUNT(*) FROM logs'),
      ['create_sale', '%humberto%', '%Mousse%'],
    );
  });

  it('filters logs by account id when tenant is selected', async () => {
    postgresService.query
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ count: '0' }] as any);

    await service.findAll(
      new QueryLogDto({ accountId: 'account-id', page: 1, perPage: 10 }),
      AUDIT_ALLOWED_EMAIL,
    );

    expect(postgresService.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE account_id = $1'),
      ['account-id', 10, 0],
    );
    expect(postgresService.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('COUNT(*) FROM logs WHERE account_id = $1'),
      ['account-id'],
    );
  });

  it('limits invalid pagination values to safe defaults', async () => {
    postgresService.query
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ count: '0' }] as any);

    const result = await service.findAll(
      new QueryLogDto({ page: -1, perPage: 500 }),
      AUDIT_ALLOWED_EMAIL,
    );

    expect(result.meta).toMatchObject({ page: 1, perPage: 100 });
    expect(postgresService.query).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      [100, 0],
    );
  });

  it('returns accounts for the authorized audit email', async () => {
    postgresService.query.mockResolvedValueOnce([
      { id: 'account-1', name: 'Cantina A', slug: 'cantina-a' },
    ] as any);

    await expect(service.findAccounts(AUDIT_ALLOWED_EMAIL)).resolves.toEqual([
      { id: 'account-1', name: 'Cantina A', slug: 'cantina-a' },
    ]);
    expect(postgresService.query).toHaveBeenCalledWith(
      'SELECT id, name, slug FROM accounts ORDER BY name ASC',
    );
  });

  it('denies account list for users different from the authorized audit email', async () => {
    await expect(service.findAccounts('other@example.com')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(postgresService.query).not.toHaveBeenCalled();
  });
});
