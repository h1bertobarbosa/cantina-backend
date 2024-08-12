import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostgresModule } from './postgres/postgres.module';
import { SigninModule } from './signin/signin.module';
import { SignupModule } from './signup/signup.module';

@Module({
  imports: [
    PostgresModule.forRoot({
      user: 'cantina',
      host: 'localhost',
      database: 'cantina',
      password: '123456',
      port: 5432,
    }),
    SigninModule,
    SignupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
