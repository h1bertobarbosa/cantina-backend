import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword } from 'class-validator';

export class CreateSignupDto {
  @IsString()
  @ApiProperty()
  companyName: string;
  @IsEmail()
  @ApiProperty()
  compantEmail: string;
  @IsString()
  @ApiProperty()
  companyDocument: string;
  @IsString()
  @ApiProperty()
  name: string;
  @IsEmail()
  @ApiProperty()
  email: string;
  @ApiProperty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;
}
