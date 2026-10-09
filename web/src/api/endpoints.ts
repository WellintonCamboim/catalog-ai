import { request } from './client';
import type {
  AuthResponse,
  Product,
  ProductFilters,
  ProductInput,
  ProductList,
  Session,
} from './types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  companyName?: string;
  inviteCode?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (input: RegisterInput) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  me: () => request<Session>('/auth/me'),
};

export const productsApi = {
  list: (filters: ProductFilters) =>
    request<ProductList>('/products', { query: { ...filters, limit: 12 } }),
  categories: () => request<{ items: string[] }>('/products/categories'),
  create: (input: ProductInput) => request<Product>('/products', { method: 'POST', body: input }),
  update: (id: string, input: Partial<ProductInput>) =>
    request<Product>(`/products/${id}`, { method: 'PUT', body: input }),
  remove: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),
};
