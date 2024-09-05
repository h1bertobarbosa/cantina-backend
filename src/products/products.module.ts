import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { LibsModule } from 'src/libs/libs.module';

@Module({
  imports: [LibsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
