import { PartialType } from '@nestjs/mapped-types';
import { CreateSigninDto } from './create-signin.dto';

export class UpdateSigninDto extends PartialType(CreateSigninDto) {}
