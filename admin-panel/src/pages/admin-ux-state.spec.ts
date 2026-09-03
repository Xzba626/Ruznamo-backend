import { describe, expect, it } from 'vitest';

function pageShowsFalseUploadSpinner(pagePhase: string, uploadPhase: string): boolean {
  return pagePhase !== 'PAGE_LOADING' && uploadPhase !== 'UPLOADING' && pagePhase === 'IDLE'
    ? false
    : uploadPhase === 'UPLOADING';
}

function canExecuteDestructive(opts: {
  passwordConfigured: boolean;
  hasPreview: boolean;
  resetPassword: string;
  confirmationPhrase: string;
  expectedPhrase: string;
}): boolean {
  if (!opts.passwordConfigured) return false;
  if (!opts.hasPreview) return false;
  if (!opts.resetPassword.trim()) return false;
  if (opts.confirmationPhrase.trim() !== opts.expectedPhrase) return false;
  return true;
}

describe('admin UX state rules', () => {
  it('does not treat idle page as upload loading', () => {
    expect(pageShowsFalseUploadSpinner('IDLE', 'IDLE')).toBe(false);
    expect(pageShowsFalseUploadSpinner('IDLE', 'FILE_SELECTED')).toBe(false);
    expect(pageShowsFalseUploadSpinner('IDLE', 'UPLOADING')).toBe(true);
  });

  it('enables execute only with password, preview and matching phrase', () => {
    expect(
      canExecuteDestructive({
        passwordConfigured: false,
        hasPreview: true,
        resetPassword: 'x',
        confirmationPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
        expectedPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
      }),
    ).toBe(false);

    expect(
      canExecuteDestructive({
        passwordConfigured: true,
        hasPreview: false,
        resetPassword: 'x',
        confirmationPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
        expectedPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
      }),
    ).toBe(false);

    expect(
      canExecuteDestructive({
        passwordConfigured: true,
        hasPreview: true,
        resetPassword: 'secret-password',
        confirmationPhrase: 'УДАЛИТЬ ВСЕ ДАННЫЕ',
        expectedPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
      }),
    ).toBe(false);

    expect(
      canExecuteDestructive({
        passwordConfigured: true,
        hasPreview: true,
        resetPassword: 'secret-password',
        confirmationPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
        expectedPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
      }),
    ).toBe(true);
  });
});
