import { LogLevel, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function setupApp(): Promise<[number, LogLevel[]]> {
  const configModule = await NestFactory.createApplicationContext(ConfigModule);
  const configService = configModule.get(ConfigService);
  const port = configService.get<number>('APP_PORT', 3000);
  const isDev = configService.get<string>('NODE_ENV') === 'development';
  const logger: LogLevel[] = isDev
    ? ['log', 'error', 'warn', 'fatal', 'verbose', 'debug']
    : ['log', 'error', 'warn', 'fatal', 'verbose'];
  return [port, logger];
}

async function bootstrap() {
  const [port, logger] = await setupApp();
  const app = await NestFactory.create(AppModule, { logger });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen(port);
}
bootstrap();
