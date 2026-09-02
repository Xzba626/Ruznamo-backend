import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileJwtAuthGuard } from '../auth/guards/mobile-jwt-auth.guard';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { requestMeta } from '../common/request-ip.util';
import { DevicesService } from './devices.service';
import { RegisterDeviceMetadataDto } from './dto/register-device-metadata.dto';
import { RevokeDeviceDto } from './dto/revoke-device.dto';

@ApiTags('mobile-devices')
@ApiBearerAuth()
@UseGuards(MobileJwtAuthGuard)
@Controller('api/v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or update an additional device for the current user' })
  register(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: RegisterDeviceMetadataDto,
    @Req() req: Request,
  ) {
    return this.devicesService.register(user, body, requestMeta(req));
  }

  @Get()
  @ApiOperation({ summary: 'List devices owned by the current user' })
  list(@CurrentUser() user: MobileJwtPayload) {
    return this.devicesService.list(user.sub);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke one of the current user devices' })
  revoke(
    @CurrentUser() user: MobileJwtPayload,
    @Body() body: RevokeDeviceDto,
    @Req() req: Request,
  ) {
    return this.devicesService.revoke(user, body.deviceId, requestMeta(req));
  }
}
