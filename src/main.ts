import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for all origins
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Serve static files from public2 directory at root path
  // This should come after controller routes to avoid conflicts
  app.useStaticAssets(join(process.cwd(), 'src', 'public'), {
    prefix: '/',
    index: 'index.html', // Serve index.html for root path
  });

  // Fallback for SPA routing - serve index.html for all unmatched routes
  app.use((req, res: Response, next) => {
    // Skip API routes and static assets
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
      return next();
    }
    res.sendFile(join(process.cwd(), 'src', 'public', 'index.html'));
  });

  await app.listen(process.env.PORT ?? 6600);
}
bootstrap();
