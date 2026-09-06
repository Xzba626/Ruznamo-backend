import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class AdminDevicesQueryDto extends PaginationQueryDto {
  /** NORMAL | REVIEW */
  @IsOptional()
  @IsString()
  @IsIn(['NORMAL', 'REVIEW'])
  integrityStatus?: 'NORMAL' | 'REVIEW';

  /** LICENSED | TRIAL | TRIAL_EXPIRED | NONE | REVOKED */
  @IsOptional()
  @IsString()
  @IsIn(['LICENSED', 'TRIAL', 'TRIAL_EXPIRED', 'NONE', 'REVOKED'])
  accessBucket?: 'LICENSED' | 'TRIAL' | 'TRIAL_EXPIRED' | 'NONE' | 'REVOKED';
}
