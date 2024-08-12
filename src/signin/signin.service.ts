import { Injectable } from '@nestjs/common';
import { CreateSigninDto } from './dto/create-signin.dto';
import { UpdateSigninDto } from './dto/update-signin.dto';

@Injectable()
export class SigninService {
  create(createSigninDto: CreateSigninDto) {
    return 'This action adds a new signin';
  }

  findAll() {
    return `This action returns all signin`;
  }

  findOne(id: number) {
    return `This action returns a #${id} signin`;
  }

  update(id: number, updateSigninDto: UpdateSigninDto) {
    return `This action updates a #${id} signin`;
  }

  remove(id: number) {
    return `This action removes a #${id} signin`;
  }
}
