import { isAdminPanelVercelOrigin, isAllowedCorsOrigin } from './cors';

describe('CORS origin rules', () => {
  const envOrigins = ['http://localhost:5173', 'https://admin-panel-ten-tau-90.vercel.app'];

  it('allows configured static origins', () => {
    expect(isAllowedCorsOrigin('http://localhost:5173', envOrigins)).toBe(true);
    expect(isAllowedCorsOrigin('https://admin-panel-ten-tau-90.vercel.app', envOrigins)).toBe(true);
  });

  it('allows Vercel preview admin panel URLs not listed explicitly', () => {
    expect(
      isAllowedCorsOrigin('https://admin-panel-git-main-xzba626s-projects.vercel.app', envOrigins),
    ).toBe(true);
    expect(isAllowedCorsOrigin('https://admin-panel-xzba626s-projects.vercel.app', envOrigins)).toBe(
      true,
    );
  });

  it('rejects unrelated origins', () => {
    expect(isAllowedCorsOrigin('https://evil.example.com', envOrigins)).toBe(false);
    expect(isAllowedCorsOrigin('https://not-admin-panel.vercel.app', envOrigins)).toBe(false);
  });

  it('matches admin-panel vercel hostnames', () => {
    expect(isAdminPanelVercelOrigin('https://admin-panel-ten-tau-90.vercel.app')).toBe(true);
    expect(isAdminPanelVercelOrigin('https://admin-panel-git-main-xzba626s-projects.vercel.app')).toBe(
      true,
    );
  });
});
