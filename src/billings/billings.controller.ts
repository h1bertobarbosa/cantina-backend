import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  Post,
} from '@nestjs/common';
import { BillingsService } from './billings.service';
import { PayBillingDto } from './dto/pay-billing.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryBillingDto } from './dto/query-billing.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillingLedgerService } from './billing-ledger.service';
import {
  CreateManagedBillingDto,
  AddBillingDebitDto,
  AddBillingCreditDto,
  AddBillingSaleDto,
  ReverseBillingItemDto,
} from './dto/manage-billing.dto';
import { UpdatePurchaseDateDto } from './dto/update-purchase-date-billing.dto';
import { DeleteBillingDto } from './dto/delete-billing.dto';

@ApiBearerAuth()
@ApiTags('billings')
@Controller('billings')
export class BillingsController {
  constructor(
    private readonly billingsService: BillingsService,
    private readonly ledgerService: BillingLedgerService,
  ) {}

  @Post()
  create(@User() user: UserSession, @Body() body: CreateManagedBillingDto) {
    return this.ledgerService.createBilling({
      ...body,
      accountId: user.accountId,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
    });
  }

  @Get(':id/ledger')
  ledger(@Param('id') id: string, @User() user: UserSession) {
    return this.billingsService.getLedger({
      accountId: user.accountId,
      id,
    });
  }

  @Post(':id/debits')
  debit(
    @Param('id') id: string,
    @User() user: UserSession,
    @Body() body: AddBillingDebitDto,
  ) {
    return this.ledgerService.addDebit({
      ...body,
      accountId: user.accountId,
      billingId: id,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
    });
  }

  @Post(':id/credits')
  credit(
    @Param('id') id: string,
    @User() user: UserSession,
    @Body() body: AddBillingCreditDto,
  ) {
    return this.ledgerService.addCredit({
      ...body,
      accountId: user.accountId,
      billingId: id,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
    });
  }

  @Post(':id/sales')
  sale(
    @Param('id') id: string,
    @User() user: UserSession,
    @Body() body: AddBillingSaleDto,
  ) {
    return this.ledgerService.addSale({
      items: body.items,
      buyDate: body.buyDate,
      clientId: body.clientId,
      accountId: user.accountId,
      billingId: id,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
    });
  }

  @Post(':id/items/:itemId/reversal')
  reversal(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @User() user: UserSession,
    @Body() body: ReverseBillingItemDto,
  ) {
    return this.ledgerService.reverseItem({
      reason: body.reason,
      itemId,
      accountId: user.accountId,
      billingId: id,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
    });
  }

  @Get()
  async findAll(@User() user: UserSession, @Query() query: QueryBillingDto) {
    return this.billingsService.findAll({
      ...query,
      accountId: user.accountId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @User() user) {
    return this.billingsService.findOne({
      accountId: user.accountId,
      id,
    });
  }
  // /billings/{id}/receipt-details
  @Get(':id/receipt-details')
  receiptDetails(@Param('id') id: string, @User() user) {
    return this.billingsService.receiptDetails({
      accountId: user.accountId,
      id,
    });
  }

  @Patch(':id/pay')
  async payBilling(
    @User() user: UserSession,
    @Param('id') id: string,
    @Body() updateBillingDto: PayBillingDto,
  ) {
    return this.ledgerService.addCredit({
      ...updateBillingDto,
      accountId: user.accountId,
      billingId: id,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
    });
  }

  @Get(':id/items')
  async billingItems(@Param('id') id: string, @User() user: UserSession) {
    return this.billingsService.getBillingItems({
      accountId: user.accountId,
      id,
    });
  }

  @Patch('items/:id/update-purchase-date')
  async updatePurchaseDate(
    @Param('id') id: string,
    @Body() updateBillingDto: UpdatePurchaseDateDto,
    @User() user: UserSession,
  ) {
    return this.billingsService.updatePurchaseDate(
      id,
      updateBillingDto.purchaseDate,
      user.accountId,
    );
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Body() body: DeleteBillingDto,
    @User() user: UserSession,
  ) {
    await this.billingsService.deleteBilling({
      id,
      accountId: user.accountId,
      userId: user.sub,
      userName: user.name,
      userEmail: user.email,
      obs: body.obs,
    });
  }
}
