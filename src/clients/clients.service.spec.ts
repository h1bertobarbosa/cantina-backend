import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService dependency management', () => {
  const responsible = {
    id: 'responsible-id',
    account_id: 'account-id',
    responsible_client_id: null,
    name: 'Responsible',
    phone: '111',
    email: 'responsible@example.com',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
  const dependent = {
    ...responsible,
    id: 'dependent-id',
    name: 'Dependent',
    email: 'dependent@example.com',
  };
  const identity = {
    accountId: 'account-id',
    responsibleClientId: 'responsible-id',
    dependentClientId: 'dependent-id',
    userId: 'user-id',
    userName: 'Operator',
    userEmail: 'operator@example.com',
  };

  let connection: { query: jest.Mock; release: jest.Mock };
  let postgres: { query: jest.Mock; getClient: jest.Mock };
  let service: ClientsService;

  beforeEach(() => {
    connection = { query: jest.fn(), release: jest.fn() };
    postgres = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(connection),
    };
    service = new ClientsService(postgres as never, {
      generate: jest.fn().mockReturnValue('log-id'),
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the responsible and direct dependents for a client', async () => {
    postgres.query
      .mockResolvedValueOnce([
        { ...dependent, responsible_client_id: responsible.id },
      ])
      .mockResolvedValueOnce([responsible])
      .mockResolvedValueOnce([dependent]);

    await expect(
      service.findDependencyDetails({
        id: dependent.id,
        accountId: 'account-id',
      }),
    ).resolves.toEqual({
      client: { id: dependent.id, name: dependent.name },
      responsible: { id: responsible.id, name: responsible.name },
      dependents: [{ id: dependent.id, name: dependent.name }],
    });
  });

  it('adds a same-account dependent and audit log atomically', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [dependent] })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValueOnce({
        rows: [{ ...dependent, responsible_client_id: responsible.id }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).resolves.toEqual({
      responsible: { id: responsible.id, name: responsible.name },
      dependent: { id: dependent.id, name: dependent.name },
    });
    expect(connection.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('responsible_client_id = $1'),
      [responsible.id, dependent.id, 'account-id'],
    );
    expect(connection.query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('INSERT INTO logs'),
      expect.arrayContaining([
        'log-id',
        'account-id',
        'user-id',
        'Operator',
        'operator@example.com',
        'client_dependency_created',
      ]),
    );
    expect(connection.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rejects a self-link before acquiring a database connection', async () => {
    await expect(
      service.addDependent({
        ...identity,
        dependentClientId: identity.responsibleClientId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(postgres.getClient).not.toHaveBeenCalled();
  });

  it('rejects a dependent that already has a responsible', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...dependent, responsible_client_id: 'another-id' }],
      })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects a dependent that already owns dependents', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [dependent] })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects a responsible client that is itself dependent', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [dependent] })
      .mockResolvedValueOnce({
        rows: [{ ...responsible, responsible_client_id: 'parent-id' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('hides a client from another account as not found', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...dependent, account_id: 'another-account' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects a concurrent assignment when the conditional update loses', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [dependent] })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rolls back the relationship when audit insertion fails', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [dependent] })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({ rows: [{ exists: false }] })
      .mockResolvedValueOnce({
        rows: [{ ...dependent, responsible_client_id: responsible.id }],
      })
      .mockRejectedValueOnce(new Error('audit unavailable'))
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.addDependent(identity)).rejects.toThrow(
      'audit unavailable',
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('removes only the requested existing dependency and audits it', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ ...dependent, responsible_client_id: responsible.id }],
      })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({
        rows: [{ ...dependent, responsible_client_id: null }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.removeDependent(identity)).resolves.toEqual({
      responsible: { id: responsible.id, name: responsible.name },
      dependent: { id: dependent.id, name: dependent.name },
    });
    expect(connection.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('responsible_client_id = NULL'),
      [dependent.id, responsible.id, 'account-id'],
    );
    expect(connection.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('INSERT INTO logs'),
      expect.arrayContaining(['client_dependency_removed']),
    );
    expect(connection.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('returns not found when removing a relationship that does not exist', async () => {
    connection.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [dependent] })
      .mockResolvedValueOnce({ rows: [responsible] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(service.removeDependent(identity)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(connection.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('blocks deletion while the client has a relationship', async () => {
    postgres.query
      .mockResolvedValueOnce([dependent])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(
      service.remove({ id: dependent.id, accountId: 'account-id' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(postgres.query).toHaveBeenCalledTimes(2);
  });

  it('whitelists client ordering before composing SQL', async () => {
    postgres.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }]);

    await service.findAll({
      accountId: 'account-id',
      page: 1,
      perPage: 10,
      sortBy: 'name; DROP TABLE clients',
      orderDir: 'asc',
    });

    expect(postgres.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('ORDER BY name ASC'),
      ['account-id', 10, 0],
    );
    expect(postgres.query.mock.calls[0][0]).not.toContain('DROP TABLE');
  });
});
