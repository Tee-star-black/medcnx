import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    organisationId: string;
    email: string;
    roles: string[];
    permissions: string[];
    sessionId: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, this.requestContext(request));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(
      dto.refreshToken,
      this.requestContext(request),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(
      request.user,
      this.requestContext(request),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.id);
  }

  private requestContext(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 500),
    };
  }
}
