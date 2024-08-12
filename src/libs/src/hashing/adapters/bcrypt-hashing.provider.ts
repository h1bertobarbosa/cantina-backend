import { HashingProvider } from '../contract/hashing-provider.interface';
import * as bcrypt from 'bcrypt';

export class BcryptHashingProvider implements HashingProvider {
  private saltOrRounds = 10;
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltOrRounds);
  }
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
