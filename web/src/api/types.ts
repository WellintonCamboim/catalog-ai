export type Role = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string;
}

export interface Company {
  id: string;
  name: string;
  inviteCode?: string;
}

export interface Session {
  user: User;
  company: Company;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string | null;
}

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
}

export interface ProductList {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductFilters {
  q?: string;
  category?: string;
  page?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
