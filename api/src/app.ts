import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { createChatRouter } from './modules/chat/chat.routes.js';
import { openRouterLlm } from './modules/chat/openrouter.llm.js';
import type { LlmClient } from './modules/chat/llm.js';
import { productRouter } from './modules/products/product.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp({ llm = openRouterLlm }: { llm?: LlmClient } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  // Uploaded images are public-read: names are random UUIDs (unguessable) and <img> tags cannot
  // send an Authorization header. Only files written by the upload endpoint live in this folder.
  app.use(
    '/uploads',
    express.static(env.UPLOAD_DIR, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/products', productRouter);
  app.use('/chat', createChatRouter(llm));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
