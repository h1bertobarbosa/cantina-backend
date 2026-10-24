import { LoggerService } from '@nestjs/common';
import * as pino from 'pino';

export class PinoLogger implements LoggerService {
  private logger: pino.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    this.logger = pino(
      isProduction
        ? { level: 'info' }
        : { level: 'debug', transport: { target: 'pino-pretty' } },
    );
  }

  log(message: string, context?: string, meta?: any) {
    this.logger.info({ context, ...meta }, message);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error({ context, stack: trace }, message);
  }

  warn(message: string, context?: string) {
    this.logger.warn({ context }, message);
  }

  debug(message: string, context?: string) {
    this.logger.debug({ context }, message);
  }

  verbose(message: string, context?: string) {
    this.logger.trace({ context }, message);
  }

  fatal(message: string, trace?: string, context?: string) {
    this.logger.fatal({ context, stack: trace }, message);
  }
}
