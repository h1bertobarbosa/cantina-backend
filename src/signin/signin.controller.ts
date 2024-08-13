import { Controller, Post, Body } from '@nestjs/common';
import { SigninService } from './signin.service';
import { CreateSigninDto } from './dto/create-signin.dto';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OutputSigninDto } from './dto/update-signin.dto';

@Controller('signin')
@ApiTags('Signin')
export class SigninController {
  constructor(private readonly signinService: SigninService) {}

  @Post()
  @ApiOkResponse({ type: OutputSigninDto })
  async create(@Body() createSigninDto: CreateSigninDto) {
    return this.signinService.create(createSigninDto);
  }
}
