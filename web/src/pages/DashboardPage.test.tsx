import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productsApi } from '../api/endpoints';
import type { Product } from '../api/types';
import { makeSession, renderWithProviders } from '../test/helpers';
import { DashboardPage } from './DashboardPage';

vi.mock('../api/endpoints', () => ({
  productsApi: { list: vi.fn(), categories: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
const api = vi.mocked(productsApi);

const product: Product = {
  id: 'p1',
  name: 'Vela Lavanda',
  description: 'Aroma suave',
  price: 49.9,
  category: 'Velas',
  imageUrl: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue({ items: [product], total: 1, page: 1, limit: 12, totalPages: 1 });
  api.categories.mockResolvedValue({ items: ['Velas'] });
});

describe('DashboardPage permissions', () => {
  it('admin can manage products and sees the invite code', async () => {
    renderWithProviders(<DashboardPage />, { session: makeSession('admin') });

    expect(await screen.findByText('Vela Lavanda')).toBeInTheDocument();
    expect(screen.getByText('R$ 49,90')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo produto/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Vela Lavanda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir Vela Lavanda' })).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('regular user gets a read-only view', async () => {
    renderWithProviders(<DashboardPage />, { session: makeSession('user') });

    expect(await screen.findByText('Vela Lavanda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo produto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
    expect(screen.queryByText('abc123')).not.toBeInTheDocument();
    expect(screen.getByText(/modo de visualização/)).toBeInTheDocument();
  });

  it('admin creates a product through the modal', async () => {
    api.create.mockResolvedValue({ ...product, id: 'p2', name: 'Novo' });
    renderWithProviders(<DashboardPage />, { session: makeSession('admin') });

    await userEvent.click(await screen.findByRole('button', { name: /Novo produto/ }));
    const dialog = screen.getByRole('dialog', { hidden: true });
    await userEvent.type(within(dialog).getByLabelText('Nome'), 'Novo');
    await userEvent.type(within(dialog).getByLabelText('Descrição'), 'Descrição');
    await userEvent.type(within(dialog).getByLabelText('Preço (R$)'), '19,90');
    await userEvent.type(within(dialog).getByLabelText('Categoria'), 'Velas');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(api.create).toHaveBeenCalledWith({
      name: 'Novo',
      description: 'Descrição',
      price: 19.9,
      category: 'Velas',
    });
  });

  it('shows an empty state when there are no products', async () => {
    api.list.mockResolvedValue({ items: [], total: 0, page: 1, limit: 12, totalPages: 1 });
    renderWithProviders(<DashboardPage />, { session: makeSession('user') });
    expect(await screen.findByText('Nenhum produto encontrado')).toBeInTheDocument();
  });
});
