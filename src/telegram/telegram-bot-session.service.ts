import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_TTL_MS = 30 * 60 * 1000;

export interface TelegramBotSessionData {
  flow: string;
  step: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class TelegramBotSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSession(telegramUserId: bigint): Promise<TelegramBotSessionData | null> {
    const row = await this.prisma.telegramBotSession.findUnique({
      where: { telegramUserId },
    });
    if (!row || row.expiresAt <= new Date()) {
      return null;
    }
    return {
      flow: row.flow,
      step: row.step,
      payload: (row.payload as Record<string, unknown> | null) ?? {},
    };
  }

  async get<T extends Record<string, unknown>>(telegramUserId: bigint, flow: string): Promise<T | null> {
    const session = await this.getSession(telegramUserId);
    if (!session || session.flow !== flow) {
      return null;
    }
    return session.payload as T;
  }

  async set(telegramUserId: bigint, flow: string, step: string | null, payload: Record<string, unknown>) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const jsonPayload = payload as Prisma.InputJsonValue;
    return this.prisma.telegramBotSession.upsert({
      where: { telegramUserId },
      create: { telegramUserId, flow, step, payload: jsonPayload, expiresAt },
      update: { flow, step, payload: jsonPayload, expiresAt },
    });
  }

  async clear(telegramUserId: bigint) {
    await this.prisma.telegramBotSession.deleteMany({ where: { telegramUserId } });
  }
}
