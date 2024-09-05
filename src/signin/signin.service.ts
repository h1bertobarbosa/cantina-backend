import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateSigninDto } from './dto/create-signin.dto';
import { OutputSigninDto } from './dto/update-signin.dto';
import {
  HASHING_PROVIDER,
  HashingProvider,
} from 'src/libs/src/hashing/contract/hashing-provider.interface';
import { PostgresService } from 'src/postgres/postgres.service';
import { JwtService } from '@nestjs/jwt';

interface UserTable {
  id: number;
  account_id: number;
  external_id: string;
  name: string;
  email: string;
  password: string;
  document: string;
  createdAt: Date;
}
@Injectable()
export class SigninService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(HASHING_PROVIDER)
    private readonly hashingProvider: HashingProvider,
    private jwtService: JwtService,
  ) {}
  async create(createSigninDto: CreateSigninDto): Promise<OutputSigninDto> {
    const res = await this.postgresService.query<UserTable>(
      'SELECT * FROM users WHERE email = $1',
      [createSigninDto.email],
    );
    if (res.length === 0) {
      throw new UnauthorizedException('User or password invalid');
    }
    const user = res[0];
    const passwordMatch = await this.hashingProvider.compare(
      createSigninDto.password,
      user.password,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('User or password invalid');
    }
    const payload = {
      sub: user.id,
      accountId: user.account_id,
      email: user.email,
      name: user.name,
    };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
