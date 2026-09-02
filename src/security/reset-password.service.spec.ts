import { ResetPasswordService } from './reset-password.service';

describe('ResetPasswordService', () => {
  const service = new ResetPasswordService();

  it('rejects weak reset passwords', async () => {
    await expect(service.hash('1234')).rejects.toThrow('RESET_PASSWORD_TOO_SHORT');
  });

  it('hashes and verifies strong passwords', async () => {
    const password = 'SecureResetPass!2026';
    const hash = await service.hash(password);
    await expect(service.verify(password, hash)).resolves.toBe(true);
    await expect(service.verify('wrong-password-value', hash)).resolves.toBe(false);
  });
});
