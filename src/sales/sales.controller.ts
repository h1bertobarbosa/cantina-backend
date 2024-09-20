import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NewSaleService } from './new-sale.service';

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
  async findAll(@User() user: UserSession) {
    return this.salesService.findAll(user.accountId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleDto: UpdateSaleDto) {
    return this.salesService.update(+id, updateSaleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.salesService.remove(+id);
  }
}
