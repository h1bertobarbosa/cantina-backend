import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { BillingsService } from './billings.service';
import { PayBillingDto } from './dto/pay-billing.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryBillingDto } from './dto/query-billing.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import PayBillingService from './pay-billing.service';
import { UpdatePurchaseDateDto } from './dto/update-purchase-date-billing.dto';
import { DeleteBillingDto } from './dto/delete-billing.dto';

@ApiBearerAuth()
@ApiTags('billings')
@Controller('billings')
export class BillingsController {
  constructor(
    private readonly billingsService: BillingsService,
    private readonly payBillingService: PayBillingService,
  ) {}

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

  @Patch(':id/pay')
  async payBilling(
    @User() user,
    @Param('id') id: string,
    @Body() updateBillingDto: PayBillingDto,
  ) {
    return this.payBillingService.execute({
      ...updateBillingDto,
      accountId: user.accountId,
      billingId: id,
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
  ) {
    return this.billingsService.updatePurchaseDate(
      id,
      updateBillingDto.purchaseDate,
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
      obs: body.obs,
    });
  }
}
