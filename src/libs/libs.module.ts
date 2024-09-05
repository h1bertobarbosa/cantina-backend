import { Module } from '@nestjs/common';
import { HASHING_PROVIDER } from './src/hashing/contract/hashing-provider.interface';
import { BcryptHashingProvider } from './src/hashing/adapters/bcrypt-hashing.provider';
import { GUID_PROVIDER } from './src/guid/contract/guid-provider.interface';
import UuidV7Provider from './src/guid/adapters/uuidv7.provider';

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
    {
      provide: GUID_PROVIDER,
      useClass: UuidV7Provider,
    },
  ];
}
