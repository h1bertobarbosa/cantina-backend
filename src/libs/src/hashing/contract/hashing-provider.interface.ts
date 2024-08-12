export interface HashingProvider {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}

export const HASHING_PROVIDER = Symbol('HashingProvider');
