import { Module } from '@nestjs/common';
import { SignupService } from './signup.service';
import { SignupController } from './signup.controller';
import { LibsModule } from 'src/libs/libs.module';

@Module({
  imports: [LibsModule],
  controllers: [SignupController],
  providers: [SignupService],
})
export class SignupModule {}
