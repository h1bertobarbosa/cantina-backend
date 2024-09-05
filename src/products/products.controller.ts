import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User, UserSession } from 'src/signin/decorators/user.decorator';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { OutputProductDto } from './dto/output-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Controller('products')
@ApiTags('products')
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiCreatedResponse({ type: OutputProductDto })
  async create(
    @User() user: UserSession,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create({
      ...createProductDto,
      accountId: user.accountId,
    });
  }

  @Get()
  async findAll(@User() user: UserSession, @Query() query: QueryProductDto) {
    return this.productsService.findAll({
      ...query,
      accountId: user.accountId,
    });
  }

  @Get(':id')
  async findOne(@User() user: UserSession, @Param('id') id: string) {
    return this.productsService.findOne({ id, accountId: user.accountId });
  }

  @Patch(':id')
  async update(
    @User() user: UserSession,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update({
      ...updateProductDto,
      id,
      accountId: user.accountId,
    });
  }

  @Delete(':id')
  async remove(@User() user: UserSession, @Param('id') id: string) {
    await this.productsService.remove({ id, accountId: user.accountId });
  }
}
