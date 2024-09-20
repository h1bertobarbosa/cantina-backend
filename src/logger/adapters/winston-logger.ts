import { LoggerService } from '@nestjs/common';
import * as winston from 'winston';

export class WinstonLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const logFormat = winston.format.printf(
      ({ level, message, timestamp, context, stack, ...meta }) => {
        let msg = `${timestamp} [${level}]${context ? ' [' + context + ']' : ''}: ${message}`;

        // Include stack trace if available
        if (stack) {
          msg += `\nStack trace:\n${stack}`;
        }

        // Include additional metadata (e.g., objects)
        if (Object.keys(meta).length) {
          msg += `\nAdditional Info: ${JSON.stringify(meta, null, 2)}`;
        }

        return msg;
      },
    );
    this.logger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      format: winston.format.combine(
        isProduction
          ? winston.format.json() // Use JSON format in production
          : winston.format.prettyPrint(), // Use pretty print in development
        winston.format.timestamp(),
        winston.format.errors({ stack: true }), // Capture stack trace
        logFormat,
      ),
      transports: [new winston.transports.Console()],
    });
  }

  log(message: string, context?: string, meta?: any) {
    this.logger.info(message, { context, ...meta });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { context, stack: trace });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
