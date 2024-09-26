import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NewSaleService } from './new-sale.service';
import { QuerySaleDto } from './dto/query-sale.dto';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly newSalesService: NewSaleService,
  ) {}

  @Post()
  async create(
    @User() user: UserSession,
    @Body() createSaleDto: CreateSaleDto,
  ) {
    return this.newSalesService.execute({
      ...createSaleDto,
      accountId: user.accountId,
    });
  }

  @Get()
  @HttpCode(HttpStatus.PARTIAL_CONTENT)
  async findAll(@User() user: UserSession, @Query() query: QuerySaleDto) {
    return this.salesService.findAll({ accountId: user.accountId, ...query });
  }

  @Get(':id')
  async findOne(@User() user: UserSession, @Param('id') id: string) {
    return this.salesService.findOne({ id, accountId: user.accountId });
  }

  @Delete(':id')
  async remove(@User() user: UserSession, @Param('id') id: string) {
    await this.salesService.remove({ id, accountId: user.accountId });
  }
}
