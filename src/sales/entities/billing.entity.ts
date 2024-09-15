import { BillingStatus } from './vo/billing-status.vo';

export default class Billing {
  private id: string;
  private accountId: string;
  private clientId: string;
  private description: string;
  private status: BillingStatus;
  private value: number;
  private amount: number;
  private quantity: number;
  private payedAt?: Date;
}
