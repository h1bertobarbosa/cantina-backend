import { ArgumentsHost, ConflictException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('Billing conflict responses', () => {
  it('preserves the active billing id so the client can open the existing billing', () => {
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/billings', method: 'POST' }),
      }),
    };
    new HttpExceptionFilter().catch(
      new ConflictException({
        message: 'Client already has an active billing.',
        activeBillingId: 'active-id',
      }),
      host as unknown as ArgumentsHost,
    );
    expect(response.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Client already has an active billing.',
        activeBillingId: 'active-id',
      }),
    );
  });
});
