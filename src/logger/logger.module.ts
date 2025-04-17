import { Module } from '@nestjs/common';
import { WinstonLogger } from './adapters/winston-logger';
import { LOGGER } from './logger.const';

const provider = { provide: LOGGER, useClass: WinstonLogger };
@Module({
  providers: [provider],
  exports: [provider],
})
export class LoggerModule {}
