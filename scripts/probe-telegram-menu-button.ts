import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnvFile(): void {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in process.env)) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

loadEnvFile();

async function call<T>(token: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await response.json()) as { ok: boolean; result?: T; description?: string };
}

async function main(): Promise<void> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (!token) {
    console.log('TELEGRAM_BOT_TOKEN missing');
    process.exitCode = 1;
    return;
  }

  const scope = { type: 'all_private_chats' as const };
  const menu = await call<{ type: string }>(token, 'getChatMenuButton', { scope });
  const cmds = await call<Array<{ command: string }>>(token, 'getMyCommands', { scope });

  console.log('getChatMenuButton:', menu.result ?? menu.description);
  console.log('getMyCommands count:', cmds.result?.length ?? 0);
  console.log(
    'commands sample:',
    cmds.result?.slice(0, 5).map((c) => c.command).join(', ') ?? 'none',
  );

  const set = await call<boolean>(token, 'setChatMenuButton', {
    menu_button: { type: 'commands' },
    scope,
  });
  console.log('setChatMenuButton ok:', set.ok);

  const menuAfter = await call<{ type: string }>(token, 'getChatMenuButton', { scope });
  console.log('getChatMenuButton after set:', menuAfter.result ?? menuAfter.description);
}

void main();
