import { ApiProperty } from '@nestjs/swagger';
import { OutputUserDto } from './output-user.dto';

export class MetaPagination {
  @ApiProperty() page: number;
  @ApiProperty() perPage: number;
  @ApiProperty() total: number;
}
export class OutputUserPaginetedResponse {
  @ApiProperty({ type: [OutputUserDto] })
  data: OutputUserDto[];
  @ApiProperty({ type: MetaPagination })
  meta: MetaPagination;
}
