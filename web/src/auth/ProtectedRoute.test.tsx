import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { makeSession, renderWithProviders } from '../test/helpers';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';

const routes = (
  <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<p>login page</p>} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route path="/" element={<p>private page</p>} />
    </Route>
  </Routes>
);

describe('route guards', () => {
  it('redirects anonymous visitors to /login', () => {
    renderWithProviders(routes, { route: '/' });
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('lets authenticated users in and keeps them out of /login', () => {
    renderWithProviders(routes, { session: makeSession('user'), route: '/' });
    expect(screen.getByText('private page')).toBeInTheDocument();
  });

  it('sends an authenticated user away from /login', () => {
    renderWithProviders(routes, { session: makeSession('user'), route: '/login' });
    expect(screen.getByText('private page')).toBeInTheDocument();
  });
});
