export interface MobileJwtPayload {
  sub: string;
  deviceId: string;
  installationId: string;
  type: 'access';
  aud: string;
}
