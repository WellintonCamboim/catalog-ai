import { createContext } from 'react';
import type { Session } from '../api/types';

export interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);
