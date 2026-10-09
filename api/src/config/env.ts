import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LLM_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
});

const DEFAULT_MODEL = 'dots-studio/dots-3-note-preview:free';

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  LLM_MODEL: parsed.data.LLM_MODEL || DEFAULT_MODEL,
};
