import type { AuthContext } from '../modules/auth/token.js';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate`. Fonte única de verdade do tenant. */
      auth?: AuthContext;
    }
  }
}

export {};
