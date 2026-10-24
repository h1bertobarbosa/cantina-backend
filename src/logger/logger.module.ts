import { Module } from '@nestjs/common';
import { PinoLogger } from './adapters/pino-logger';
import { LOGGER } from './logger.const';

const provider = { provide: LOGGER, useClass: PinoLogger };
@Module({
  providers: [provider],
  exports: [provider],
})
export class LoggerModule {}
