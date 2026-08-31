export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string };
  requestId: string;
}

export interface AdminProfile {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  telegramConnected: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface Paginated<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
