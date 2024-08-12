import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SigninService } from './signin.service';
import { CreateSigninDto } from './dto/create-signin.dto';
import { UpdateSigninDto } from './dto/update-signin.dto';

@Controller('signin')
export class SigninController {
  constructor(private readonly signinService: SigninService) {}

  @Post()
  create(@Body() createSigninDto: CreateSigninDto) {
    return this.signinService.create(createSigninDto);
  }

  @Get()
  findAll() {
    return this.signinService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.signinService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSigninDto: UpdateSigninDto) {
    return this.signinService.update(+id, updateSigninDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.signinService.remove(+id);
  }
}
