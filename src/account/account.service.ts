import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        category: true,
        status: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return user;
  }

  async updateAccount(userId: string, dto: UpdateAccountDto) {
    const data: {
      displayName?: string;
      category?: UpdateAccountDto['category'];
      phone?: string;
    } = {};

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
    }
    if (dto.category !== undefined) {
      data.category = dto.category;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        displayName: true,
        category: true,
        status: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }
}
