import { BillingsController } from './billings.controller';
import { BillingsService } from './billings.service';
import { BillingLedgerService } from './billing-ledger.service';
import { UserSession } from 'src/signin/decorators/user.decorator';

describe('BillingsController management', () => {
  const user = {
    accountId: 'account',
    sub: 'user',
    name: 'Operator',
    email: 'operator@test.local',
  } as UserSession;
  const identity = {
    accountId: 'account',
    billingId: 'billing',
    userId: 'user',
    userName: 'Operator',
    userEmail: 'operator@test.local',
  };
  let controller: BillingsController;
  let ledger: Record<string, jest.Mock>;
  let reads: { getLedger: jest.Mock };
  const result = { id: 'billing', amount: '25.00' };

  beforeEach(() => {
    ledger = Object.fromEntries(
      ['createBilling', 'addDebit', 'addCredit', 'addSale', 'reverseItem'].map(
        (name) => [name, jest.fn().mockResolvedValue(result)],
      ),
    );
    reads = { getLedger: jest.fn().mockResolvedValue(result) };
    controller = new BillingsController(
      reads as unknown as BillingsService,
      ledger as unknown as BillingLedgerService,
    );
  });

  it('creates a billing using the authenticated account', async () => {
    const body = {
      clientId: 'client',
      description: 'Opening',
      amount: 25,
      accountId: 'forged',
    };
    expect(await controller.create(user, body)).toEqual(result);
    expect(ledger.createBilling).toHaveBeenCalledWith({
      ...body,
      accountId: 'account',
      userId: 'user',
      userName: 'Operator',
      userEmail: 'operator@test.local',
    });
  });

  it('reads the ledger within the authenticated account', async () => {
    expect(await controller.ledger('billing', user)).toEqual(result);
    expect(reads.getLedger).toHaveBeenCalledWith({
      id: 'billing',
      accountId: 'account',
    });
  });

  it('adds a debit to the route billing within the account', async () => {
    const body = { amount: 25, description: 'Debit' };
    expect(await controller.debit('billing', user, body)).toEqual(result);
    expect(ledger.addDebit).toHaveBeenCalledWith({
      ...body,
      accountId: 'account',
      billingId: 'billing',
      userId: 'user',
      userName: 'Operator',
      userEmail: 'operator@test.local',
    });
  });

  it.each(['credit', 'payBilling'] as const)(
    '%s delegates payment with the authenticated user snapshot',
    async (method) => {
      const body = {
        amount: 25,
        paymentMethod: 'PIX',
        accountId: 'forged',
        billingId: 'forged',
      };
      expect(
        await controller[method](
          ...((method === 'credit'
            ? ['billing', user, body]
            : [user, 'billing', body]) as [never, never, never]),
        ),
      ).toEqual(result);
      expect(ledger.addCredit).toHaveBeenCalledWith({ ...body, ...identity });
    },
  );

  it('adds a sale for the selected invoice consumer', async () => {
    const body = {
      items: [{ productId: 'product', price: 5, quantity: 2 }],
      buyDate: '2026-10-06',
      clientId: 'forged',
    };
    expect(await controller.sale('billing', user, body)).toEqual(result);
    expect(ledger.addSale).toHaveBeenCalledWith({
      items: body.items,
      buyDate: body.buyDate,
      clientId: body.clientId,
      ...identity,
    });
  });

  it('reverses the route item with reason and authenticated user', async () => {
    expect(
      await controller.reversal('billing', 'item', user, {
        reason: 'Duplicate',
      }),
    ).toEqual(result);
    expect(ledger.reverseItem).toHaveBeenCalledWith({
      reason: 'Duplicate',
      itemId: 'item',
      ...identity,
    });
  });
});
