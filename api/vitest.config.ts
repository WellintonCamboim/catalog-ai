import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/catalog_ai_test',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-16-chars',
    },
  },
});
