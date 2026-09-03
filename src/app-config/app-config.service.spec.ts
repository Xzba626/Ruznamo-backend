import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Platform } from '@prisma/client';
import { AppConfigService } from './app-config.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AppConfigService', () => {
  let service: AppConfigService;

  const prisma = {
    appVersion: { findFirst: jest.fn() },
    systemConfig: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'telegram.botUsername' ? 'ruznamo_bot' : undefined)) },
        },
      ],
    }).compile();

    service = module.get(AppConfigService);
  });

  it('returns maintenance and android config from database', async () => {
    prisma.appVersion.findFirst.mockResolvedValue({
      latestVersion: '1.2.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: 'https://example.com/app.apk',
      forceUpdate: false,
      releaseNotes: 'EN notes',
      releaseNotesTj: 'TJ notes',
    });
    prisma.systemConfig.findMany.mockResolvedValue([]);
    prisma.systemConfig.findUnique.mockImplementation(
      async ({ where }: { where: { key: string } }) => {
        if (where.key === 'MAINTENANCE_MODE') return { value: 'false' };
        if (where.key === 'MAINTENANCE_MESSAGE_TJ') return { value: 'Таъмир' };
        if (where.key === 'CONFIG_VERSION') return { value: '1' };
        return null;
      },
    );

    const result = await service.getPublicConfig(Platform.ANDROID, '1.0.0');

    expect(result.configVersion).toBe('1');
    expect(result.maintenance.enabled).toBe(false);
    expect(result.android.latestVersion).toBe('1.2.0');
    expect(result.android.updateRecommended).toBe(true);
    expect(result.android.updateRequired).toBe(false);
    expect(result.telegramBotUsername).toBe('ruznamo_bot');
    expect(result.serverTime).toBeDefined();
  });

  it('normalizes t.me URL in telegram bot username config', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'telegram.botUsername' ? 'https://t.me/Ruznamo_bot' : undefined,
            ),
          },
        },
      ],
    }).compile();

    const urlService = module.get(AppConfigService);
    prisma.appVersion.findFirst.mockResolvedValue({
      latestVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: null,
      forceUpdate: false,
      releaseNotes: null,
      releaseNotesTj: null,
    });
    prisma.systemConfig.findMany.mockResolvedValue([]);
    prisma.systemConfig.findUnique.mockResolvedValue({ value: '1' });

    const result = await urlService.getPublicConfig(Platform.ANDROID);
    expect(result.telegramBotUsername).toBe('Ruznamo_bot');
  });

  it('marks updateRequired when client below minimum version', async () => {
    prisma.appVersion.findFirst.mockResolvedValue({
      latestVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: null,
      forceUpdate: false,
      releaseNotes: null,
      releaseNotesTj: null,
    });
    prisma.systemConfig.findMany.mockResolvedValue([]);
    prisma.systemConfig.findUnique.mockResolvedValue({ value: '1' });

    const result = await service.getPublicConfig(Platform.ANDROID, '1.0.0');

    expect(result.android.updateRequired).toBe(true);
  });

  it('never invents 1.0.0 when AppVersion row is missing', async () => {
    prisma.appVersion.findFirst.mockResolvedValue(null);
    prisma.systemConfig.findMany.mockResolvedValue([]);
    prisma.systemConfig.findUnique.mockResolvedValue({ value: '1' });

    const result = await service.getPublicConfig(Platform.ANDROID, '1.0.10');

    expect(result.android.latestVersion).toBeNull();
    expect(result.android.minimumSupportedVersion).toBeNull();
    expect(result.android.updateRequired).toBe(false);
    expect(result.android.updateRecommended).toBe(false);
  });
});
