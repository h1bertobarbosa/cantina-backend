import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PostgresModule } from './postgres/postgres.module';
import { SigninModule } from './signin/signin.module';
import { SignupModule } from './signup/signup.module';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from './products/products.module';
import { ClientsModule } from './clients/clients.module';
import jwtConfig from './signin/config/jwt.config';
import pgConfig from './postgres/config/pg.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      load: [jwtConfig, pgConfig],
    }),
    PostgresModule.forRoot(pgConfig()),
    SigninModule,
    SignupModule,
    ProductsModule,
    ClientsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
