import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');

  const port = configService.getOrThrow<number>('PORT');

  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const configuredOrigins = (
    configService.get<string>('FRONTEND_URLS') ?? frontendUrl
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(
    isProduction
      ? configuredOrigins
      : [
          ...configuredOrigins,
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ],
  );

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  if (configService.get<string>('TRUST_PROXY') === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as Postman.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked request from origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port, '0.0.0.0');

  console.log(`MedCNX API listening on port ${port}.`);
}

void bootstrap();
