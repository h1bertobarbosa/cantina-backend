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
  async create(createSignupDto: CreateSignupDto): Promise<OutputSignupDto> {
    const client = await this.postgresService.getClient();

    try {
      const res = await client.query(
        'SELECT count(id) FROM accounts WHERE document = $1',
        [createSignupDto.companyDocument],
      );

      if (res.rows[0].count > 0) {
        throw new BadRequestException('Account already exists');
      }
      await client.query('BEGIN');

      const resAccount = await client.query(
        'INSERT INTO accounts (id,name, email, document) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          this.guidProvider.generate(),
          createSignupDto.companyName,
          createSignupDto.compantEmail,
          createSignupDto.companyDocument,
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
