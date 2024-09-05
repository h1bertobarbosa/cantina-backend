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

  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTkxYmY5NC0wYTE5LTdjY2EtYmI1Yi1jYjVmMGQ1MjE5OGIiLCJhY2NvdW50SWQiOiIwMTkxYmY5NC0wYTE4LTdjY2EtYmI1Yi1jMDVkZmNkY2Q2OWIiLCJlbWFpbCI6Imh1bWJlcnRvLm9iYXJib3NhQGdtYWlsLmNvbSIsIm5hbWUiOiJIdW1iZXJ0byIsImlhdCI6MTcyNTQ5NjA2MH0.SXpBAwJavTGW3m0nmvpy8SU5YHKjyLsIPt0Ps-AlTAU
 
  */
