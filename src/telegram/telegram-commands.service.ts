import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBotApiService } from './telegram-bot-api.service';

export interface BotCommandDef {
  command: string;
  descriptionRu: string;
  descriptionTj: string;
}

export const USER_BOT_COMMANDS: BotCommandDef[] = [
  { command: 'start', descriptionRu: 'Запустить Ruznamo', descriptionTj: 'Оғози Ruznamo' },
  { command: 'stop', descriptionRu: 'Завершить текущую операцию', descriptionTj: 'Қатъ кардани амал' },
  { command: 'instruction', descriptionRu: 'Инструкция', descriptionTj: 'Дастур' },
];

export const ADMIN_BOT_COMMANDS: BotCommandDef[] = [
  { command: 'start', descriptionRu: 'Панель администратора', descriptionTj: 'Панели маъмур' },
  { command: 'stop', descriptionRu: 'Завершить текущую операцию', descriptionTj: 'Қатъ кардани амал' },
];

@Injectable()
export class TelegramCommandsService implements OnModuleInit {
  private readonly logger = new Logger(TelegramCommandsService.name);

  constructor(
    private readonly botApi: TelegramBotApiService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.get<boolean>('telegram.enabled')) {
      return;
    }
    try {
      await this.registerDefaultCommands();
      this.logger.log('Telegram bot commands registered');
    } catch (error) {
      this.logger.warn({ error }, 'Failed to register Telegram bot commands on startup');
    }
  }

  async registerDefaultCommands(): Promise<void> {
    await this.botApi.setMyCommands(
      USER_BOT_COMMANDS.map((cmd) => ({
        command: cmd.command,
        description: `${cmd.descriptionRu} / ${cmd.descriptionTj}`,
      })),
      { type: 'all_private_chats' },
    );
    await this.botApi.setChatMenuButton({ type: 'commands' }, { type: 'all_private_chats' });
  }

  async registerAdminCommandsForChat(chatId: bigint): Promise<void> {
    await this.botApi.setMyCommands(
      ADMIN_BOT_COMMANDS.map((cmd) => ({
        command: cmd.command,
        description: `${cmd.descriptionRu} / ${cmd.descriptionTj}`,
      })),
      { type: 'chat', chat_id: Number(chatId) },
    );
  }
}
