import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { imageStorage, isLocalImage } from '../uploads/imageStorage.js';
import { sniffImage } from '../uploads/imageType.js';
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

// Best effort: a leftover file is harmless, a failed request because of it is not.
async function discardImage(companyId: string, imageUrl: string) {
  await imageStorage.delete(companyId, imageUrl).catch(() => undefined);
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
    const before = input.imageUrl ? await productRepository.findById(companyId, id) : null;
    const product = await productRepository.update(companyId, id, input);
    if (!product) throw notFound('Produto não encontrado');
    // A new external URL replaces an uploaded file, which would otherwise be left orphaned.
    if (isLocalImage(before?.imageUrl)) await discardImage(companyId, before.imageUrl);
    return toProductDto(product);
  },

  async remove(companyId: string, id: string) {
    const product = await productRepository.findById(companyId, id);
    if (!product || !(await productRepository.remove(companyId, id))) {
      throw notFound('Produto não encontrado');
    }
    if (isLocalImage(product.imageUrl)) await discardImage(companyId, product.imageUrl);
  },

  async setImage(companyId: string, id: string, file: Express.Multer.File | undefined) {
    const product = await productRepository.findById(companyId, id);
    if (!product) throw notFound('Produto não encontrado');
    if (!file) throw badRequest('Envie o arquivo no campo "image"');

    const ext = sniffImage(file.buffer);
    if (!ext) throw new AppError(415, 'Formato não suportado: use PNG, JPEG ou WebP');

    const imageUrl = await imageStorage.save(companyId, file.buffer, ext);
    let updated;
    try {
      updated = await productRepository.update(companyId, id, { imageUrl });
    } catch (err) {
      await discardImage(companyId, imageUrl);
      throw err;
    }
    if (!updated) {
      await discardImage(companyId, imageUrl);
      throw notFound('Produto não encontrado');
    }
    if (isLocalImage(product.imageUrl)) await discardImage(companyId, product.imageUrl);
    return toProductDto(updated);
  },

  async removeImage(companyId: string, id: string) {
    const product = await productRepository.findById(companyId, id);
    if (!product) throw notFound('Produto não encontrado');
    const updated = await productRepository.clearImage(companyId, id);
    if (!updated) throw notFound('Produto não encontrado');
    if (isLocalImage(product.imageUrl)) await discardImage(companyId, product.imageUrl);
    return toProductDto(updated);
  },

  categories: (companyId: string) => productRepository.listCategories(companyId),
};
