import { Controller, Get, Body, Patch, Param, Query } from '@nestjs/common';
import { BillingsService } from './billings.service';
import { PayBillingDto } from './dto/pay-billing.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryBillingDto } from './dto/query-billing.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import PayBillingService from './pay-billing.service';

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
}
