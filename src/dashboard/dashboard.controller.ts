import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryTotalSaleDto } from './dto/query-total-sale.dto';
@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('total-sales')
  async getTotalSales(
    @User() user: UserSession,
    @Query() query: QueryTotalSaleDto,
  ) {
    return this.dashboardService.getTotalSales({
      ...query,
      accountId: user.accountId,
    });
  }
}
