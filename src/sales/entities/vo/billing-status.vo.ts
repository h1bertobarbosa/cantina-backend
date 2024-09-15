export enum BillingStatusEnum {
  OPEN = 'OPEN',
  PAYED = 'PAYED',
}
export class BillingStatus {
  constructor(private readonly value: string) {
    this.value = BillingStatusEnum[value];
  }
  getValue() {
    return this.value;
  }
}
