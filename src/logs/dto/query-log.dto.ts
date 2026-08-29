import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

export class QueryLogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PER_PAGE)
  perPage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  orderDir?: 'asc' | 'desc';

  constructor(partial: Partial<QueryLogDto>) {
    Object.assign(this, partial);
    const page = Number(this.page);
    const perPage = Number(this.perPage);

    this.page =
      Number.isInteger(page) && page >= DEFAULT_PAGE ? page : DEFAULT_PAGE;
    this.perPage =
      Number.isInteger(perPage) && perPage >= 1
        ? Math.min(perPage, MAX_PER_PAGE)
        : DEFAULT_PER_PAGE;
    this.orderDir = this.orderDir || 'desc';
    this.orderBy = this.orderBy || 'created_at';
  }
}
