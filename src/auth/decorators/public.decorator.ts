import { SetMetadata } from '@nestjs/common';

export const MOBILE_PUBLIC_KEY = 'isPublic';
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(MOBILE_PUBLIC_KEY, true);
