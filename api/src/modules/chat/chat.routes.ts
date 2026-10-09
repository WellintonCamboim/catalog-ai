import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { createChatController } from './chat.controller.js';
import { chatSchema } from './chat.schemas.js';
import { createChatService } from './chat.service.js';
import type { LlmClient } from './llm.js';

// Each call costs LLM tokens, so the limit is per user rather than per IP.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? 'anonymous',
  validate: { keyGeneratorIpFallback: false },
  skip: () => env.NODE_ENV === 'test',
});

export function createChatRouter(llm: LlmClient) {
  const router = Router();
  const chat = createChatController(createChatService(llm));
  router.post('/', authenticate, chatLimiter, validate(chatSchema), chat);
  return router;
}
