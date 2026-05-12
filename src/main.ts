import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: [
      'http://localhost:3999',
      'http://127.0.0.1:3999',
      'https://chat.butterflyai.io',
    ],
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'assets'), { prefix: '/assets/' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
