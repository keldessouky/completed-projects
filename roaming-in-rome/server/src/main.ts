import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  // Restrict CORS to the configured web origin.
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });

  // Validate and strip unknown properties on every request body. forbidNonWhitelisted
  // rejects unexpected fields (e.g. a sneaky `role`), transform coerces types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Roaming in Rome API listening on http://localhost:${port}`);
}

void bootstrap();
