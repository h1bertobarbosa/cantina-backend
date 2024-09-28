import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { TransactionPaymentMethodEnum } from 'src/transactions/value-objects/transaction-payment-method.vo';

export class PayBillingDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;
  @ApiProperty({ enum: TransactionPaymentMethodEnum })
  @IsNotEmpty()
  @IsString()
  paymentMethod: string;
  accountId: string;
  billingId: string;
}
