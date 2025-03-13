import { Controller, Get } from '@nestjs/common';
import { Public } from './signin/decorators/public.decorator';

@Controller()
@Public()
export class AppController {
  @Get('/healthcheck')
  getHello() {
    return { status: 'UP' };
  }
}
