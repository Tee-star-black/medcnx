import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';

type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type SessionUser = {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  organisation: { id: string; name: string; slug: string };
  userRoles: Array<{
    role: {
      name: string;
      rolePermissions: Array<{ permission: { key: string } }>;
    };
  }>;
};

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash =
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, context: RequestContext = {}) {
    const email = loginDto.email.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: {
        email,
        status: 'ACTIVE',
        ...(loginDto.organisationSlug
          ? { organisation: { slug: loginDto.organisationSlug } }
          : {}),
      },
      include: this.userInclude(),
      take: 2,
    });

    if (users.length !== 1) {
      await bcrypt.compare(loginDto.password, this.dummyPasswordHash);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const user = users[0] as SessionUser & {
      passwordHash: string;
      failedLoginAttempts: number;
      lockedUntil: Date | null;
    };
    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      throw new UnauthorizedException(
        'This account is temporarily locked. Try again later.',
      );
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.recordFailedLogin(user, context);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const sessionId = randomUUID();
    const refreshSecret = randomBytes(48).toString('base64url');
    const refreshToken = `${sessionId}.${refreshSecret}`;
    const refreshExpiresAt = new Date(
      now.getTime() +
        this.durationToMilliseconds(
          this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
        ),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      }),
      this.prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: this.hashRefreshSecret(refreshSecret),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          expiresAt: refreshExpiresAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.LOGIN,
          entity: 'AuthSession',
          entityId: sessionId,
          message: 'User signed in.',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
    ]);

    return {
      accessToken: await this.signAccessToken(user, sessionId),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
      user: this.toPublicUser(user),
    };
  }

  async refresh(rawRefreshToken: string, context: RequestContext = {}) {
    const [sessionId, refreshSecret, ...extra] = rawRefreshToken.split('.');
    if (!sessionId || !refreshSecret || extra.length) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: this.userInclude(),
        },
      },
    });
    const now = new Date();

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== 'ACTIVE' ||
      !this.safeHashMatches(
        session.refreshTokenHash,
        this.hashRefreshSecret(refreshSecret),
      )
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const nextSecret = randomBytes(48).toString('base64url');
    const nextRefreshToken = `${session.id}.${nextSecret}`;
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashRefreshSecret(nextSecret),
        ipAddress: context.ipAddress ?? session.ipAddress,
        userAgent: context.userAgent ?? session.userAgent,
      },
    });

    return {
      accessToken: await this.signAccessToken(
        session.user as SessionUser,
        session.id,
      ),
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    };
  }

  async logout(
    user: { id: string; organisationId: string; sessionId: string },
    context: RequestContext = {},
  ) {
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: {
          id: user.sessionId,
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.LOGOUT,
          entity: 'AuthSession',
          entityId: user.sessionId,
          message: 'User signed out.',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
    ]);

    return { success: true };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organisationId: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        organisation: {
          select: { id: true, name: true, slug: true },
        },
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { key: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active.');
    }

    return this.toPublicUser(user as SessionUser);
  }

  private async recordFailedLogin(
    user: SessionUser & { failedLoginAttempts: number },
    context: RequestContext,
  ) {
    const maxAttempts = this.positiveInteger('AUTH_MAX_LOGIN_ATTEMPTS', 5);
    const lockMinutes = this.positiveInteger('AUTH_LOCKOUT_MINUTES', 15);
    const nextAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      nextAttempts >= maxAttempts
        ? new Date(Date.now() + lockMinutes * 60_000)
        : null;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: lockedUntil ? 0 : nextAttempts,
          lockedUntil,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          action: AuditAction.LOGIN,
          entity: 'Authentication',
          entityId: user.id,
          message: lockedUntil
            ? 'Account temporarily locked after repeated failed sign-in attempts.'
            : 'Failed sign-in attempt.',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { successful: false, locked: Boolean(lockedUntil) },
        },
      }),
    ]);
  }

  private async signAccessToken(user: SessionUser, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        organisationId: user.organisationId,
        email: user.email,
        sid: sessionId,
      },
      {
        secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow('JWT_ACCESS_EXPIRES_IN'),
      },
    );
  }

  private toPublicUser(user: SessionUser) {
    const roles = user.userRoles.map((item) => item.role.name);
    const permissions = user.userRoles.flatMap((item) =>
      item.role.rolePermissions.map(({ permission }) => permission.key),
    );

    return {
      id: user.id,
      organisationId: user.organisationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      organisation: user.organisation,
      roles,
      permissions: [...new Set(permissions)],
    };
  }

  private userInclude() {
    return {
      organisation: {
        select: { id: true, name: true, slug: true },
      },
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    };
  }

  private hashRefreshSecret(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeHashMatches(expected: string, actual: string) {
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  }

  private durationToMilliseconds(value: string) {
    const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
    if (!match) {
      throw new Error(
        'JWT_REFRESH_EXPIRES_IN must use a duration such as 30m, 12h or 7d.',
      );
    }
    const amount = Number(match[1]);
    const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return amount * units[match[2] as keyof typeof units];
  }

  private positiveInteger(key: string, fallback: number) {
    const parsed = Number(this.configService.get<string>(key) ?? fallback);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
