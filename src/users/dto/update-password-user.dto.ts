import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsStrongPassword,
  ValidateIf,
} from 'class-validator';

export class UpdatePasswordUserDto {
  @ApiProperty()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 0,
  })
  password: string;
  @IsString()
  @IsDefined()
  @IsIn([Math.random()], {
    message: 'Passwords do not match',
  })
  @ValidateIf((o) => o.password !== o.passwordConfirm)
  passwordConfirm: string;
  @IsOptional()
  accountId: string;
  @IsOptional()
  id: string;
}
