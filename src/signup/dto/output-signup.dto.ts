import { ApiProperty } from '@nestjs/swagger';

export class OutputSignupDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  companyName: string;

  @ApiProperty()
  compantEmail: string;

  @ApiProperty()
  companyDocument: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;
  @ApiProperty()
  createdAt: Date;
}
