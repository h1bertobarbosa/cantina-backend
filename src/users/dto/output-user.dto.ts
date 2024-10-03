import { ApiProperty } from '@nestjs/swagger';
import { UsersTable } from '../ports/users-table.interface';

export class OutputUserDto {
  @ApiProperty()
  readonly id: string;
  @ApiProperty()
  readonly name: string;
  @ApiProperty()
  readonly email: string;
  @ApiProperty()
  readonly createdAt: Date;
  @ApiProperty()
  readonly updatedAt: Date;

  constructor(user: any) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.createdAt = user.created_at;
    this.updatedAt = user.updated_at;
  }

  static fromTable(user: UsersTable) {
    return new OutputUserDto(user);
  }
}
