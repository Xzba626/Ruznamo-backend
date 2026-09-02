import { Injectable } from '@nestjs/common';
import {
  SupportConversationStatus,
  SupportMessageContentType,
  SupportMessageDirection,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SupportCategoryCode } from './bot-flow.constants';

@Injectable()
export class SupportConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(
    telegramAccountId: string,
    category: SupportCategoryCode,
  ): Promise<{ id: string }> {
    const existing = await this.prisma.supportConversation.findFirst({
      where: { telegramAccountId, status: SupportConversationStatus.OPEN },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.supportConversation.update({
        where: { id: existing.id },
        data: { category, updatedAt: new Date() },
      });
      return existing;
    }
    return this.prisma.supportConversation.create({
      data: { telegramAccountId, status: SupportConversationStatus.OPEN, category },
      select: { id: true },
    });
  }

  async getOrCreateOpenConversation(telegramAccountId: string): Promise<{ id: string }> {
    const existing = await this.prisma.supportConversation.findFirst({
      where: { telegramAccountId, status: SupportConversationStatus.OPEN },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.supportConversation.create({
      data: { telegramAccountId, status: SupportConversationStatus.OPEN },
      select: { id: true },
    });
  }

  async appendUserMessage(input: {
    telegramAccountId: string;
    conversationId?: string;
    contentType: SupportMessageContentType;
    text?: string;
    caption?: string;
    fileId?: string;
    telegramMessageId?: bigint;
  }): Promise<{ conversationId: string; messageId: string }> {
    const conversation = input.conversationId
      ? { id: input.conversationId }
      : await this.getOrCreateOpenConversation(input.telegramAccountId);
    const message = await this.prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        direction: SupportMessageDirection.USER_TO_ADMIN,
        contentType: input.contentType,
        text: input.text ?? null,
        caption: input.caption ?? null,
        fileId: input.fileId ?? null,
        telegramMessageId: input.telegramMessageId ?? null,
      },
    });
    await this.prisma.supportConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    return { conversationId: conversation.id, messageId: message.id };
  }

  async appendAdminMessage(input: {
    conversationId: string;
    text?: string;
    caption?: string;
    fileId?: string;
    contentType?: SupportMessageContentType;
    telegramMessageId?: bigint;
  }): Promise<void> {
    await this.prisma.supportMessage.create({
      data: {
        conversationId: input.conversationId,
        direction: SupportMessageDirection.ADMIN_TO_USER,
        contentType: input.contentType ?? SupportMessageContentType.TEXT,
        text: input.text ?? null,
        caption: input.caption ?? null,
        fileId: input.fileId ?? null,
        telegramMessageId: input.telegramMessageId ?? null,
      },
    });
    await this.prisma.supportConversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });
  }

  async listOpenConversations(limit = 20) {
    const conversations = await this.prisma.supportConversation.findMany({
      where: { status: SupportConversationStatus.OPEN },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        telegramAccount: {
          select: {
            id: true,
            username: true,
            firstName: true,
            telegramId: true,
            language: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
    });

    return conversations.map((c) => ({
      id: c.id,
      ticketLabel: this.ticketLabel(c.id),
      category: c.category,
      openedAt: c.createdAt,
      updatedAt: c.updatedAt,
      userDisplayName: c.telegramAccount.firstName ?? 'Пользователь',
      username: c.telegramAccount.username ? `@${c.telegramAccount.username.replace(/^@/, '')}` : null,
      telegramUserId: c.telegramAccount.telegramId.toString(),
      telegramAccountId: c.telegramAccount.id,
      userChatId: c.telegramAccount.telegramId,
      userLanguage: c.telegramAccount.language,
      latestPreview: this.previewMessage(c.messages[0]),
      messageCount: c._count.messages,
    }));
  }

  async getConversationHistory(conversationId: string) {
    return this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      include: {
        telegramAccount: {
          select: { id: true, username: true, firstName: true, telegramId: true, language: true },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async closeConversation(conversationId: string): Promise<void> {
    await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { status: SupportConversationStatus.CLOSED, closedAt: new Date() },
    });
  }

  ticketLabel(conversationId: string): string {
    return conversationId.slice(-4).toUpperCase();
  }

  private previewMessage(
    message?: { text: string | null; caption: string | null; contentType: SupportMessageContentType } | null,
  ): string {
    if (!message) return '—';
    if (message.text?.trim()) return message.text.trim().slice(0, 120);
    if (message.caption?.trim()) return message.caption.trim().slice(0, 120);
    if (message.contentType === SupportMessageContentType.PHOTO) return '[Фото]';
    if (message.contentType === SupportMessageContentType.DOCUMENT) return '[Документ]';
    return '—';
  }
}
