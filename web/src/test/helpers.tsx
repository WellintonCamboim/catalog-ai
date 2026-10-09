import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Role, Session } from '../api/types';
import { AuthContext } from '../auth/context';

export const makeSession = (role: Role): Session => ({
  user: { id: 'u1', name: 'Ana', email: 'ana@a.com', role, companyId: 'c1' },
  company: { id: 'c1', name: 'Empresa A', ...(role === 'admin' && { inviteCode: 'abc123' }) },
});

export function renderWithProviders(
  ui: ReactElement,
  { session = null, route = '/' }: { session?: Session | null; route?: string } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ session, loading: false, signIn: async () => {}, signOut: () => {} }}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
