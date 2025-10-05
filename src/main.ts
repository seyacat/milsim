import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for all origins
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Serve static files from public directory at root path
  // This should come after controller routes to avoid conflicts
  app.useStaticAssets(join(process.cwd(), 'src', 'public'), {
    prefix: '/',
    index: false, // Disable automatic index.html serving
  });

  await app.listen(process.env.PORT ?? 6600);
}
bootstrap();
