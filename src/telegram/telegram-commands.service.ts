import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBotApiService } from './telegram-bot-api.service';

export interface BotCommandDef {
  command: string;
  descriptionRu: string;
  descriptionTj: string;
}

export const USER_BOT_COMMANDS: BotCommandDef[] = [
  { command: 'start', descriptionRu: 'Главное меню', descriptionTj: 'Менюи асосӣ' },
  { command: 'buy', descriptionRu: 'Купить лицензию', descriptionTj: 'Харидани иҷозатнома' },
  { command: 'licenses', descriptionRu: 'Мои лицензии', descriptionTj: 'Иҷозатномаҳои ман' },
  { command: 'instruction', descriptionRu: 'Инструкция', descriptionTj: 'Дастур' },
  { command: 'support', descriptionRu: 'Поддержка', descriptionTj: 'Дастгирӣ' },
  { command: 'language', descriptionRu: 'Язык', descriptionTj: 'Забон' },
  { command: 'home', descriptionRu: 'Главное меню', descriptionTj: 'Менюи асосӣ' },
];

export const ADMIN_BOT_COMMANDS: BotCommandDef[] = [
  ...USER_BOT_COMMANDS,
  { command: 'admin', descriptionRu: 'Меню администратора', descriptionTj: 'Менюи маъмур' },
  { command: 'requisites', descriptionRu: 'Реквизиты', descriptionTj: 'Реквизитҳо' },
  { command: 'orders', descriptionRu: 'Заявки на оплату', descriptionTj: 'Дархостҳои пардохт' },
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
