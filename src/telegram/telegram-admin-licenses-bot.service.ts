import { Injectable } from '@nestjs/common';
import { LicenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { formatDateLocalized } from './telegram.messages';
import type { InlineKeyboardMarkup } from './telegram.types';
import { getTelegramI18n } from './i18n';
import { TelegramLanguage } from '@prisma/client';
import { readMaxDevicesFromFeatures } from '../admin/common/plan-features.util';

const PAGE_SIZE = 5;

@Injectable()
export class TelegramAdminLicensesBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botApi: TelegramBotApiService,
  ) {}

  private mask(prefix: string): string {
    if (prefix.length <= 4) return `${prefix}••••`;
    return `••••${prefix.slice(-4).toUpperCase()}`;
  }

  async showList(chatId: bigint, page = 0): Promise<void> {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    const total = await this.prisma.license.count();
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const items = await this.prisma.license.findMany({
      skip: safePage * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        holderTelegramAccount: true,
        activations: { where: { revokedAt: null }, include: { device: true } },
      },
    });

    if (items.length === 0) {
      await this.botApi.sendMessage(chatId, 'Нет лицензий в базе.', {
        inline_keyboard: [[{ text: msgs.menuBack, callback_data: 'action:main_menu' }]],
      });
      return;
    }

    const lines = items.map((lic) => {
      const used = lic.activations.filter((a) => !a.device.revokedAt).length;
      const holder = lic.holderTelegramAccount?.username
        ? `@${lic.holderTelegramAccount.username.replace(/^@/, '')}`
        : '—';
      const expires = lic.expiresAt ? formatDateLocalized(lic.expiresAt, 'RU') : '—';
      return `${lic.plan.name} · ${lic.status}\n${this.mask(lic.keyPrefix)} · ${used} устр. · ${holder}\nДо: ${expires}`;
    });

    const rows: InlineKeyboardMarkup['inline_keyboard'] = items.map((lic) => [
      {
        text: `${lic.plan.name} · ${this.mask(lic.keyPrefix)}`,
        callback_data: `admin:lic:detail:${lic.id}`,
      },
    ]);
    const nav: InlineKeyboardMarkup['inline_keyboard'][number] = [];
    if (safePage > 0) nav.push({ text: '◀️', callback_data: `admin:lic:page:${safePage - 1}` });
    if (safePage + 1 < totalPages) nav.push({ text: '▶️', callback_data: `admin:lic:page:${safePage + 1}` });
    if (nav.length) rows.push(nav);
    rows.push([{ text: msgs.menuBack, callback_data: 'action:main_menu' }]);

    await this.botApi.sendMessage(
      chatId,
      `🔑 Лицензии\nСтраница ${safePage + 1} из ${totalPages}\n\n${lines.join('\n\n')}`,
      { inline_keyboard: rows },
    );
  }

  async showDetail(chatId: bigint, licenseId: string): Promise<void> {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    const lic = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        plan: { include: { features: true } },
        holderTelegramAccount: true,
        purchaserTelegramAccount: true,
        activations: { where: { revokedAt: null }, include: { device: true } },
      },
    });
    if (!lic) {
      await this.botApi.sendMessage(chatId, 'Данные больше недоступны.', {
        inline_keyboard: [[{ text: msgs.adminMenuLicenses, callback_data: 'admin:licenses' }]],
      });
      return;
    }

    const used = lic.activations.filter((a) => !a.device.revokedAt).length;
    const limit = readMaxDevicesFromFeatures(lic.plan.features, 2) ?? 2;
    const holder = lic.holderTelegramAccount?.username
      ? `@${lic.holderTelegramAccount.username.replace(/^@/, '')}`
      : '—';
    const purchaser = lic.purchaserTelegramAccount?.username
      ? `@${lic.purchaserTelegramAccount.username.replace(/^@/, '')}`
      : '—';
    const expires = lic.expiresAt ? formatDateLocalized(lic.expiresAt, 'RU') : '—';

    const text =
      `Тариф: ${lic.plan.name}\n` +
      `Статус: ${lic.status}\n` +
      `Ключ: ${this.mask(lic.keyPrefix)}\n` +
      `Источник: ${lic.issueSource ?? '—'}\n` +
      `Действует до: ${expires}\n` +
      `Устройства: ${used} из ${limit}\n` +
      `Покупатель: ${purchaser}\n` +
      `Текущий держатель: ${holder}`;

    const rows: InlineKeyboardMarkup['inline_keyboard'] = [
      [{ text: '📱 Устройства', callback_data: `admin:lic:devices:${lic.id}` }],
    ];
    if (lic.status === LicenseStatus.ACTIVE) {
      rows.push([{ text: '🚫 Отозвать', callback_data: `admin:lic:revoke:confirm:${lic.id}` }]);
    }
    rows.push([{ text: msgs.menuBack, callback_data: 'admin:licenses' }]);

    await this.botApi.sendMessage(chatId, text, { inline_keyboard: rows });
  }

  async showDevices(chatId: bigint, licenseId: string): Promise<void> {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    const lic = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        activations: {
          include: { device: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!lic) {
      await this.botApi.sendMessage(chatId, 'Данные больше недоступны.');
      return;
    }

    const lines = lic.activations.map((a) => {
      const d = a.device;
      const label =
        [d.deviceManufacturer, d.deviceModel, d.deviceName].filter(Boolean).join(' ') || 'Device';
      const status = a.revokedAt || d.revokedAt ? 'Отключено' : 'Активно';
      return `• ${label}\n  ${status} · ${d.appVersion ?? '—'} · ${formatDateLocalized(a.createdAt, 'RU')}`;
    });

    await this.botApi.sendMessage(
      chatId,
      `📱 Устройства лицензии\n\n${lines.join('\n\n') || 'Нет активаций'}`,
      {
        inline_keyboard: [[{ text: msgs.menuBack, callback_data: `admin:lic:detail:${licenseId}` }]],
      },
    );
  }

  async showRevokeConfirm(chatId: bigint, licenseId: string): Promise<void> {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    const lic = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: { plan: true },
    });
    if (!lic || lic.status !== LicenseStatus.ACTIVE) {
      await this.botApi.sendMessage(chatId, 'Лицензия уже недоступна для отзыва.', {
        inline_keyboard: [[{ text: msgs.adminMenuLicenses, callback_data: 'admin:licenses' }]],
      });
      return;
    }

    await this.botApi.sendMessage(
      chatId,
      `Отозвать лицензию ${lic.plan.name} ${this.mask(lic.keyPrefix)}?\n\n` +
        `Все активные устройства потеряют доступ по этому ключу.`,
      {
        inline_keyboard: [
          [
            { text: '✅ Отозвать', callback_data: `admin:lic:revoke:do:${licenseId}` },
            { text: '↩️ Отмена', callback_data: `admin:lic:detail:${licenseId}` },
          ],
        ],
      },
    );
  }

  async revokeLicense(chatId: bigint, licenseId: string, adminTelegramId: bigint): Promise<void> {
    const msgs = getTelegramI18n(TelegramLanguage.RU);
    const lic = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!lic || lic.status !== LicenseStatus.ACTIVE) {
      await this.botApi.sendMessage(chatId, 'Лицензия уже отозвана или недоступна.', {
        inline_keyboard: [[{ text: msgs.adminMenuLicenses, callback_data: 'admin:licenses' }]],
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id: licenseId },
        data: { status: LicenseStatus.REVOKED, revokedAt: new Date() },
      });
      await tx.licenseActivation.updateMany({
        where: { licenseId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'ADMIN_DISCONNECT' },
      });
    });

    await this.botApi.sendMessage(chatId, '✅ Лицензия отозвана.', {
      inline_keyboard: [
        [{ text: msgs.adminMenuLicenses, callback_data: 'admin:licenses' }],
        [{ text: msgs.replyMainMenu, callback_data: 'action:main_menu' }],
      ],
    });
  }
}
