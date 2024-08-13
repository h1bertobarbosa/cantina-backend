import { ApiProperty } from '@nestjs/swagger';

export class OutputSigninDto {
  @ApiProperty()
  accessToken: string;
  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }
}
