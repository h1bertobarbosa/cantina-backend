import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Cantina')
    .setDescription('The cantina API description')
    .setVersion('1.0')
    .addTag('cantina')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);
  await app.listen(3000);
}
bootstrap();
/*
"email": "humberto.obarbosa@gmail.com",
  "password": "xgmy01Hob@"

  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXh0ZXJuYWxJZCI6IjI3ZWE1NjUyLTBiOTAtNDVjMS05MGMzLWQxOTY1Zjk5NGRkYiIsImFjY291bnRJZCI6IjEiLCJlbWFpbCI6Imh1bWJlcnRvLm9iYXJib3NhQGdtYWlsLmNvbSIsIm5hbWUiOiJodW1iZXJ0byIsImlhdCI6MTcyNTQ5MzIzNn0.Q44XMyo3o-zbuJmAN92WuPUxdBmhcrw8YwOZ5powPRE
  */
