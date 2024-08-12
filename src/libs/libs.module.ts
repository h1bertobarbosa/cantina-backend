import { Module } from '@nestjs/common';
import { HASHING_PROVIDER } from './src/hashing/contract/hashing-provider.interface';
import { BcryptHashingProvider } from './src/hashing/adapters/bcrypt-hashing.provider';

@Module({
  providers: getProviders(),
  exports: getProviders(),
})
export class LibsModule {}

function getProviders() {
  return [
    {
      provide: HASHING_PROVIDER,
      useClass: BcryptHashingProvider,
    },
  ];
}
