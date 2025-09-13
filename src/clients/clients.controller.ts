import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Put,
  Delete,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryClientDto } from './dto/query-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateChargeDto } from './dto/create-charge-history.dto';
import { QueryHistoryChargeDto } from './dto/query-history-charge.dto';

@ApiBearerAuth()
@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async create(
    @User() user: UserSession,
    @Body() createClientDto: CreateClientDto,
  ) {
    return this.clientsService.create({
      ...createClientDto,
      accountId: user.accountId,
    });
  }

  @Get()
  @HttpCode(HttpStatus.PARTIAL_CONTENT)
  async findAll(@User() user: UserSession, @Query() query: QueryClientDto) {
    return this.clientsService.findAll({
      ...query,
      accountId: user.accountId,
    });
  }

  @Get('/charge-logs')
  @HttpCode(HttpStatus.PARTIAL_CONTENT)
  async findAllHistoryCharge(
    @User() user: UserSession,
    @Query() query: QueryHistoryChargeDto,
  ) {
    return this.clientsService.findAllHistoryCharge({
      ...query,
      accountId: user.accountId,
    });
  }

  @Get(':id')
  findOne(@User() user: UserSession, @Param('id') id: string) {
    return this.clientsService.findOne({ id, accountId: user.accountId });
  }

  @Put(':id')
  async update(
    @User() user: UserSession,
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientsService.update({
      ...updateClientDto,
      id,
      accountId: user.accountId,
    });
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@User() user: UserSession, @Param('id') id: string) {
    await this.clientsService.remove({ id, accountId: user.accountId });
  }

  @Post(':id/register-charge')
  async registerCharge(
    @User() user: UserSession,
    @Param('id') id: string,
    @Body() body: CreateChargeDto,
  ) {
    return this.clientsService.registerCharge({
      ...body,
      userId: user.sub,
      clientId: id,
      accountId: user.accountId,
      ocurrencyDate: new Date(body.createdAt),
    });
  }
}
