import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: { database: { status: 'up' } },
              error: {},
              details: { database: { status: 'up' } },
            }),
          },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns liveness payload', () => {
    const result = controller.liveness();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });

  it('returns root API info', () => {
    const result = controller.root();
    expect(result.success).toBe(true);
    expect(result.data.links.health).toBe('/health');
    expect(result.data.links.docs).toBe('/api/docs');
  });

  it('returns readiness payload', async () => {
    const result = await controller.readiness();
    expect(result.status).toBe('ok');
  });
});
