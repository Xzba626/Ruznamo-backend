import { describe, expect, it } from 'vitest';
import { ru } from './ru';
import { tj } from './tj';

describe('admin production UX copy', () => {
  it('RU data management has no English dry run leakage', () => {
    expect(ru.dataReset.subtitle.toLowerCase()).not.toContain('dry run');
    expect(ru.dataReset.preview.toLowerCase()).not.toContain('dry');
    expect(ru.dataReset.subtitle).toMatch(/[а-яА-ЯёЁ]/);
  });

  it('TJ data management has no English dry run leakage', () => {
    expect(tj.dataReset.subtitle.toLowerCase()).not.toContain('dry run');
    expect(tj.dataReset.preview.toLowerCase()).not.toContain('dry');
  });

  it('updates empty/history/storage strings exist in RU and TJ', () => {
    expect(ru.updates.noCurrentTitle).toBeTruthy();
    expect(ru.updates.historyEmpty).toBeTruthy();
    expect(ru.updates.storageNotConfigured).toMatch(/Хранилище/);
    expect(tj.updates.historyEmpty).toBeTruthy();
    expect(tj.updates.storageNotConfigured).toMatch(/Захирагоҳ/);
  });

  it('execute remains gated by password and preview copy', () => {
    expect(ru.dataReset.executeDisabledNoPassword).toMatch(/парол/i);
    expect(ru.dataReset.executeDisabledNoPreview).toMatch(/предварительн/i);
    expect(ru.dataReset.executeGateNote).toMatch(/отключено/i);
  });
});
