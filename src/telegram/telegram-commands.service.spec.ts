import { TelegramCommandsService, USER_BOT_COMMANDS } from './telegram-commands.service';

describe('TelegramCommandsService', () => {
  const botApi = {
    setMyCommands: jest.fn().mockResolvedValue(undefined),
    setChatMenuButton: jest.fn().mockResolvedValue(undefined),
  };

  const configService = {
    get: jest.fn((key: string) => (key === 'telegram.enabled' ? true : undefined)),
  };

  const service = new TelegramCommandsService(botApi as never, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers commands and explicit commands menu button on startup', async () => {
    await service.onModuleInit();

    expect(botApi.setMyCommands).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ command: 'start' })]),
      { type: 'all_private_chats' },
    );
    expect(botApi.setChatMenuButton).toHaveBeenCalledWith(
      { type: 'commands' },
      { type: 'all_private_chats' },
    );
  });

  it('registerDefaultCommands sets menu button type commands', async () => {
    await service.registerDefaultCommands();

    expect(botApi.setMyCommands).toHaveBeenCalledWith(
      USER_BOT_COMMANDS.map((cmd) => ({
        command: cmd.command,
        description: `${cmd.descriptionRu} / ${cmd.descriptionTj}`,
      })),
      { type: 'all_private_chats' },
    );
    expect(botApi.setChatMenuButton).toHaveBeenCalledWith(
      { type: 'commands' },
      { type: 'all_private_chats' },
    );
  });

  it('registers extended admin commands for admin chat scope', async () => {
    await service.registerAdminCommandsForChat(12345n);

    expect(botApi.setMyCommands).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ command: 'admin' })]),
      { type: 'chat', chat_id: 12345 },
    );
  });
});
