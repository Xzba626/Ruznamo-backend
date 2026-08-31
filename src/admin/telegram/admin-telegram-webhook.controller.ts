import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { AdminTelegramService, TelegramUpdate } from './admin-telegram.service';

@ApiTags('telegram-webhook')
@Controller('api/v1/telegram/admin')
export class AdminTelegramWebhookController {
  constructor(
    private readonly telegramService: AdminTelegramService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Telegram admin bot webhook (server-side only)' })
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
    @Req() req: { body: TelegramUpdate },
  ): Promise<{ ok: true }> {
    const expected = this.configService.get<string>('telegram.webhookSecret');
    if (expected && secretToken !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    await this.telegramService.processAdminBotUpdate(req.body);
    return { ok: true };
  }
}
