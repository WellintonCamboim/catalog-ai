import { notFound } from '../../lib/errors.js';
import type {
  CreateProductInput,
  ListProductsInput,
  UpdateProductInput,
} from './product.schemas.js';
import type { ProductDoc } from './product.model.js';
import { productRepository } from './product.repository.js';

type ProductRecord = ProductDoc & { _id: unknown };

// Public shape of a product: company_id never leaves the server.
export function toProductDto(p: ProductRecord) {
  return {
    id: String(p._id),
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    imageUrl: p.imageUrl ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export const productService = {
  async list(companyId: string, filters: ListProductsInput) {
    const { items, total, page, limit } = await productRepository.list(companyId, filters);
    return {
      items: items.map(toProductDto),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  async get(companyId: string, id: string) {
    const product = await productRepository.findById(companyId, id);
    if (!product) throw notFound('Produto não encontrado');
    return toProductDto(product);
  },

  async create(companyId: string, input: CreateProductInput) {
    return toProductDto(await productRepository.create(companyId, input));
  },

  async update(companyId: string, id: string, input: UpdateProductInput) {
    const product = await productRepository.update(companyId, id, input);
    if (!product) throw notFound('Produto não encontrado');
    return toProductDto(product);
  },

  async remove(companyId: string, id: string) {
    if (!(await productRepository.remove(companyId, id))) throw notFound('Produto não encontrado');
  },

  categories: (companyId: string) => productRepository.listCategories(companyId),
};
