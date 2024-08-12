import { Controller, Post, Body } from '@nestjs/common';
import { SignupService } from './signup.service';
import { CreateSignupDto } from './dto/create-signup.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('signup')
@ApiTags('Signup')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post()
  async create(@Body() createSignupDto: CreateSignupDto) {
    return this.signupService.create(createSignupDto);
  }
}
