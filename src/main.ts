import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { LOGGER } from './logger/logger.const';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.enableCors({ origin: '*' });
  app.useLogger(app.get(LOGGER));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
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

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTkxYmY5NC0wYTE5LTdjY2EtYmI1Yi1jYjVmMGQ1MjE5OGIiLCJhY2NvdW50SWQiOiIwMTkxYmY5NC0wYTE4LTdjY2EtYmI1Yi1jMDVkZmNkY2Q2OWIiLCJlbWFpbCI6Imh1bWJlcnRvLm9iYXJib3NhQGdtYWlsLmNvbSIsIm5hbWUiOiJIdW1iZXJ0byIsImlhdCI6MTcyNjg1NjkwM30.KQ9w5vk24uy2_5hQQmm8Vfigypf1ejMU50QWx6aDo_8

  */
