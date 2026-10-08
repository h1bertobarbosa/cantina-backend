import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { UserSession } from 'src/signin/decorators/user.decorator';

describe('ClientsController dependency management', () => {
  const user: UserSession = {
    accountId: 'account-id',
    sub: 'user-id',
    name: 'Operator',
    email: 'operator@example.com',
  };
  const result = {
    client: { id: 'responsible-id', name: 'Responsible' },
    responsible: null,
    dependents: [{ id: 'dependent-id', name: 'Dependent' }],
  };
  let controller: ClientsController;
  let service: {
    findDependencyDetails: jest.Mock;
    addDependent: jest.Mock;
    removeDependent: jest.Mock;
  };

  beforeEach(() => {
    service = {
      findDependencyDetails: jest.fn().mockResolvedValue(result),
      addDependent: jest.fn().mockResolvedValue(result),
      removeDependent: jest.fn().mockResolvedValue(result),
    };
    controller = new ClientsController(service as unknown as ClientsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('reads dependencies within the authenticated account', async () => {
    await expect(
      controller.findDependencyDetails(user, 'responsible-id'),
    ).resolves.toEqual(result);
    expect(service.findDependencyDetails).toHaveBeenCalledWith({
      id: 'responsible-id',
      accountId: 'account-id',
    });
  });

  it('adds a dependent with the authenticated user snapshot', async () => {
    await expect(
      controller.addDependent(user, 'responsible-id', {
        dependentClientId: 'dependent-id',
      }),
    ).resolves.toEqual(result);
    expect(service.addDependent).toHaveBeenCalledWith({
      accountId: 'account-id',
      responsibleClientId: 'responsible-id',
      dependentClientId: 'dependent-id',
      userId: 'user-id',
      userName: 'Operator',
      userEmail: 'operator@example.com',
    });
  });

  it('removes a dependent with the authenticated user snapshot', async () => {
    await expect(
      controller.removeDependent(user, 'responsible-id', 'dependent-id'),
    ).resolves.toEqual(result);
    expect(service.removeDependent).toHaveBeenCalledWith({
      accountId: 'account-id',
      responsibleClientId: 'responsible-id',
      dependentClientId: 'dependent-id',
      userId: 'user-id',
      userName: 'Operator',
      userEmail: 'operator@example.com',
    });
  });
});
