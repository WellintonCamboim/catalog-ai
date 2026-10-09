import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { anthropicLlm } from './modules/chat/anthropic.llm.js';
import { createChatRouter } from './modules/chat/chat.routes.js';
import type { LlmClient } from './modules/chat/llm.js';
import { productRouter } from './modules/products/product.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp({ llm = anthropicLlm }: { llm?: LlmClient } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

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
