export enum TransactionPaymentMethodEnum {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BOLETO = 'BOLETO',
  CASH = 'CASH',
  TO_RECEIVE = 'TO_RECEIVE',
}
export class TransactionPaymentMethod {
  private constructor(private readonly value: string) {
    if (!(this.value in TransactionPaymentMethodEnum)) {
      throw new Error('TransactionPaymentMethodEnum is not valid');
    }
    this.value = TransactionPaymentMethodEnum[this.value.toUpperCase()];
  }
  getValue() {
    return this.value;
  }

  static getInstance(value: string) {
    return new TransactionPaymentMethod(value);
  }
}
