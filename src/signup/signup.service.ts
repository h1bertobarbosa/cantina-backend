import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateSignupDto } from './dto/create-signup.dto';
import { OutputSignupDto } from './dto/output-signup.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import {
  HASHING_PROVIDER,
  HashingProvider,
} from 'src/libs/src/hashing/contract/hashing-provider.interface';
import {
  GUID_PROVIDER,
  GuidProvider,
} from 'src/libs/src/guid/contract/guid-provider.interface';

@Injectable()
export class SignupService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(HASHING_PROVIDER)
    private readonly hashingProvider: HashingProvider,
    @Inject(GUID_PROVIDER)
    private readonly guidProvider: GuidProvider,
  ) {}
  private slugfy(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s/g, '-');
  }
  async create(createSignupDto: CreateSignupDto): Promise<OutputSignupDto> {
    const client = await this.postgresService.getClient();
    const slug = this.slugfy(createSignupDto.companyName);
    try {
      const res = await client.query(
        'SELECT count(id) FROM accounts WHERE slug = $1',
        [slug],
      );

      if (res.rows[0].count > 0) {
        throw new BadRequestException('Account already exists');
      }
      await client.query('BEGIN');

      const resAccount = await client.query(
        'INSERT INTO accounts (id,name, email, document,slug) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [
          this.guidProvider.generate(),
          createSignupDto.companyName,
          createSignupDto.companyEmail,
          createSignupDto.companyDocument,
          slug,
        ],
      );

      const resUser = await client.query(
        'INSERT INTO users(id, account_id, name, email,password) VALUES ($1, $2,$3,$4, $5) RETURNING *',
        [
          this.guidProvider.generate(),
          resAccount.rows[0].id,
          createSignupDto.name,
          createSignupDto.email,
          await this.hashingProvider.hash(createSignupDto.password),
        ],
      );
      await client.query('COMMIT');

      return {
        id: resUser.rows[0].id,
        companyName: createSignupDto.companyName,
        companyEmail: createSignupDto.companyEmail,
        companyDocument: createSignupDto.companyDocument,
        name: createSignupDto.name,
        email: createSignupDto.email,
        createdAt: resUser.rows[0].createdAt,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
