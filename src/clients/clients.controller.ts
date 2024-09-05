import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryClientDto } from './dto/query-client.dto';
// import { UpdateClientDto } from './dto/update-client.dto';

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
  async findAll(@User() user: UserSession, @Query() query: QueryClientDto) {
    return this.clientsService.findAll({
      ...query,
      accountId: user.accountId,
    });
  }

  @Get(':id')
  findOne(@User() user: UserSession, @Param('id') id: string) {
    return this.clientsService.findOne({ id, accountId: user.accountId });
  }
  /**
   * 

 

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(+id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(+id);
  }
   */
}
