import type { AuthContext } from '../modules/auth/token.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. The only trusted source of the tenant (companyId). */
      auth?: AuthContext;
    }
  }
}

export {};
