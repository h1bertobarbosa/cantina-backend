import { Module } from '@nestjs/common';
import { SigninService } from './signin.service';
import { SigninController } from './signin.controller';
import { JwtModule } from '@nestjs/jwt';
import { LibsModule } from 'src/libs/libs.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
@Module({
  imports: [
    LibsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SigninController],
  providers: [
    ...getPoviders(),
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [...getPoviders()],
})
export class SigninModule {}

function getPoviders() {
  return [SigninService];
}
