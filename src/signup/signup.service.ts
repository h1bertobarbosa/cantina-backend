import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateSignupDto } from './dto/create-signup.dto';
import { OutputSignupDto } from './dto/output-signup.dto';
import { PostgresService } from 'src/postgres/postgres.service';
import {
  HASHING_PROVIDER,
  HashingProvider,
} from 'src/libs/src/hashing/contract/hashing-provider.interface';

@Injectable()
export class SignupService {
  constructor(
    private readonly postgresService: PostgresService,
    @Inject(HASHING_PROVIDER)
    private readonly hashingProvider: HashingProvider,
  ) {}
  async create(createSignupDto: CreateSignupDto): Promise<OutputSignupDto> {
    const client = await this.postgresService.getClient();

    try {
      // TODO: Check if exists
      const res = await client.query(
        'SELECT count(id) FROM accounts WHERE document = $1',
        [createSignupDto.companyDocument],
      );

      if (res.rows[0].count > 0) {
        throw new BadRequestException('Account already exists');
      }
      await client.query('BEGIN');

      const resAccount = await client.query(
        'INSERT INTO accounts (name, email, document) VALUES ($1, $2, $3) RETURNING *',
        [
          createSignupDto.companyName,
          createSignupDto.compantEmail,
          createSignupDto.companyDocument,
        ],
      );

      const resUser = await client.query(
        'INSERT INTO users(account_id, name, email,password) VALUES ($1, $2,$3,$4) RETURNING *',
        [
          resAccount.rows[0].id,
          createSignupDto.name,
          createSignupDto.email,
          await this.hashingProvider.hash(createSignupDto.password),
        ],
      );
      await client.query('COMMIT');

      return {
        id: resUser.rows[0].external_id,
        companyName: createSignupDto.companyName,
        compantEmail: createSignupDto.compantEmail,
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
