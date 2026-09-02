import * as fs from 'fs';
import * as path from 'path';

describe('Telegram navigation — no persistent ReplyKeyboardMarkup', () => {
  const telegramDir = path.join(__dirname);

  const sourceFiles = fs
    .readdirSync(telegramDir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => path.join(telegramDir, name));

  it('does not send persistent reply keyboards in telegram source files', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('is_persistent: true')) {
        offenders.push(`${path.basename(file)}: is_persistent`);
      }
      if (/(?<![\w])keyboard:\s*\[\[\s*\{/.test(content)) {
        offenders.push(`${path.basename(file)}: reply keyboard matrix`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('exports ReplyKeyboardRemove helper for legacy cleanup', () => {
    const markup = fs.readFileSync(path.join(telegramDir, 'telegram-markup.ts'), 'utf8');
    expect(markup).toContain('remove_keyboard: true');
  });
});
