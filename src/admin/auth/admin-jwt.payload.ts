export interface AdminJwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  aud: string;
  type: 'access';
}
