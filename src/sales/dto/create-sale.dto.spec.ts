import { ValidationPipe } from '@nestjs/common';
import { CreateSaleDto } from './create-sale.dto';
import {
  AddBillingSaleDto,
  AddBillingCreditDto,
  CreateManagedBillingDto,
} from 'src/billings/dto/manage-billing.dto';

describe('Financial request validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const validItem = { productId: 'product', price: 10, quantity: 2 };
  const sale = {
    clientId: 'client',
    paymentMethod: 'TO_RECEIVE',
    items: [validItem],
  };
  const transform = (value: unknown, metatype: any) =>
    pipe.transform(value, { type: 'body', metatype });

  it.each([
    [null],
    'not-an-array',
    [],
    [{}],
    [{ ...validItem, quantity: 1.5 }],
    [{ ...validItem, price: 1.234 }],
  ])(
    'rejects malformed existing-sale items %j with HTTP 400',
    async (items) => {
      await expect(
        transform({ ...sale, items }, CreateSaleDto),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it.each([
    [null],
    [{ ...validItem, quantity: 1.5 }],
    [{ ...validItem, price: 1.234 }],
  ])('rejects malformed managed-sale items %j with HTTP 400', async (items) => {
    await expect(transform({ items }, AddBillingSaleDto)).rejects.toMatchObject(
      { status: 400 },
    );
  });
  it('retains the valid paid-sale contract', async () => {
    expect(
      await transform({ ...sale, paymentMethod: 'PIX' }, CreateSaleDto),
    ).toMatchObject({ ...sale, paymentMethod: 'PIX' });
  });
  it('rejects a missing credit method and negative initial amount with HTTP 400', async () => {
    await expect(
      transform({ amount: 10 }, AddBillingCreditDto),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      transform(
        { clientId: 'client', description: 'Opening', amount: -1 },
        CreateManagedBillingDto,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
