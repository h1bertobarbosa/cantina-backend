import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryLogDto } from './dto/query-log.dto';
import { LogsService } from './logs.service';

@ApiTags('logs')
@ApiBearerAuth()
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('accounts')
  async findAccounts(@User() user: UserSession) {
    return this.logsService.findAccounts(user.email);
  }

  @Get()
  @HttpCode(HttpStatus.PARTIAL_CONTENT)
  async findAll(@User() user: UserSession, @Query() query: QueryLogDto) {
    return this.logsService.findAll(new QueryLogDto(query), user.email);
  }
}
