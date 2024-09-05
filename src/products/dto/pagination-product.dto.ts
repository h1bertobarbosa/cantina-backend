import { ApiProperty } from '@nestjs/swagger';
import { OutputProductDto } from './output-product.dto';

export class MetaPagination {
  @ApiProperty() page: number;
  @ApiProperty() perPage: number;
  @ApiProperty() total: number;
}
export class OutputProfessionalPaginetedResponse {
  @ApiProperty({ type: [OutputProductDto] })
  data: OutputProductDto[];
  @ApiProperty({ type: MetaPagination })
  meta: MetaPagination;
}
