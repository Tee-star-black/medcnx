import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

type JwtPayload = {
  sub: string;
  organisationId: string;
  email: string;
  sid: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.organisationId || !payload.sid) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            organisationId: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    name: true,
                    rolePermissions: {
                      select: {
                        permission: {
                          select: {
                            key: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const user = session?.user;
    if (
      !session ||
      !user ||
      user.status !== 'ACTIVE' ||
      user.organisationId !== payload.organisationId
    ) {
      throw new UnauthorizedException('Access session is no longer valid.');
    }

    const roles = user.userRoles.map((userRole) => userRole.role.name);

    const permissions = user.userRoles.flatMap((userRole) =>
      userRole.role.rolePermissions.map(
        (rolePermission) => rolePermission.permission.key,
      ),
    );

    return {
      id: user.id,
      organisationId: user.organisationId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles,
      permissions: [...new Set(permissions)],
      sessionId: session.id,
    };
  }
}
