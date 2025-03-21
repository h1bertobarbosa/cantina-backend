import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SignupService } from './signup.service';
import { CreateSignupDto } from './dto/create-signup.dto';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { OutputSignupDto } from './dto/output-signup.dto';
import { Public } from 'src/signin/decorators/public.decorator';

@Controller('signup')
@ApiTags('Signup')
@Public()
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post()
  @ApiCreatedResponse({ type: OutputSignupDto })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSignupDto: CreateSignupDto) {
    return this.signupService.create(createSignupDto);
  }
}
