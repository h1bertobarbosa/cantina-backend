export default class OutputSaleDto {
  constructor(
    readonly id: string,
    readonly clientName: string,
    readonly description: string,
    readonly paymentMethod: string,
    readonly amount: number,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly payedAt?: Date,
  ) {}
}
