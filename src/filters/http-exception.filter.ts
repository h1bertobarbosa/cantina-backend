import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Determine the error message
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : exceptionResponse['message'] || exception.message;

    // Customize the response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };
    Logger.log(message, HttpExceptionFilter.name);
    response.status(status).json(errorResponse);
  }
}
