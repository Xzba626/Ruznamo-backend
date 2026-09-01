import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../admin/decorators/public.decorator';
import { TelegramUpdateProcessor } from './telegram-update.processor';
import { TelegramUpdate } from './telegram.types';

@ApiTags('telegram')
@SkipThrottle()
@Controller('api/v1/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly processor: TelegramUpdateProcessor,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Single Telegram bot webhook' })
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secretToken: string | undefined,
    @Req() req: { body: TelegramUpdate },
  ): Promise<{ ok: true }> {
    const expected = this.configService.get<string>('telegram.webhookSecret');
    const isProduction = this.configService.get<boolean>('app.isProduction', false);

    if (isProduction && !expected) {
      throw new UnauthorizedException('Telegram webhook secret is not configured');
    }

    if (expected && secretToken !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    await this.processor.processUpdate(req.body);
    return { ok: true };
  }
}
