import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { LibsModule } from 'src/libs/libs.module';

@Module({
  imports: [LibsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
