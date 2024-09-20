import { Module } from '@nestjs/common';
import { WinstonLogger } from './adapters/winston-logger';
import { LOGGER } from './logger.const';

@Module({
  providers: [{ provide: LOGGER, useClass: WinstonLogger }],
})
export class LoggerModule {}
