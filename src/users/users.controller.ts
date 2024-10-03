import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { QueryUserDto } from './dto/query-user.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdatePasswordUserDto } from './dto/update-password-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(
    @User() user: UserSession,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.create({
      ...createUserDto,
      accountId: user.accountId,
    });
  }

  @Get()
  @HttpCode(HttpStatus.PARTIAL_CONTENT)
  async findAll(@User() user: UserSession, @Query() query: QueryUserDto) {
    return this.usersService.findAll({ ...query, accountId: user.accountId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @User() user: UserSession) {
    return this.usersService.findOne({
      id,
      accountId: user.accountId,
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @User() user: UserSession,
  ) {
    return this.usersService.update({
      ...updateUserDto,
      id,
      accountId: user.accountId,
    });
  }

  @Patch(':id/change-password')
  async updatePassword(
    @Param('id') id: string,
    @Body() updateUserDto: UpdatePasswordUserDto,
    @User() user: UserSession,
  ) {
    return this.usersService.updatePassword({
      ...updateUserDto,
      id,
      accountId: user.accountId,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @User() user: UserSession) {
    await this.usersService.remove({
      id,
      accountId: user.accountId,
    });
  }
}
