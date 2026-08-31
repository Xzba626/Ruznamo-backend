import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { AccountService } from './account.service';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('mobile-account')
@ApiBearerAuth()
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Get current mobile account profile' })
  getAccount(@CurrentUser() user: MobileJwtPayload) {
    return this.accountService.getAccount(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Update safe account fields' })
  updateAccount(@CurrentUser() user: MobileJwtPayload, @Body() body: UpdateAccountDto) {
    return this.accountService.updateAccount(user.sub, body);
  }
}
