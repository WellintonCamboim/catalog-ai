import { isValidObjectId, type QueryFilter } from 'mongoose';
import { Product, type ProductDoc } from './product.model.js';

export type ProductData = Pick<ProductDoc, 'name' | 'description' | 'price' | 'category'> & {
  imageUrl?: string;
};

export interface ProductFilters {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every function takes companyId as its first argument: there is no way to call the
// repository without choosing a tenant.
export const productRepository = {
  async list(companyId: string, filters: ProductFilters = {}) {
    const { q, category, minPrice, maxPrice, page = 1, limit = 20 } = filters;
    const query: QueryFilter<ProductDoc> = { company_id: companyId };

    if (category) query.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    if (q) {
      // Every word must match somewhere (name, description or category), in any order.
      const words = q.split(/\s+/).filter((w) => w.length >= 3);
      const terms = words.length > 0 ? words : [q];
      query.$and = terms.map((term) => {
        const rx = new RegExp(escapeRegex(term), 'i');
        return { $or: [{ name: rx }, { description: rx }, { category: rx }] };
      });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {
        ...(minPrice !== undefined && { $gte: minPrice }),
        ...(maxPrice !== undefined && { $lte: maxPrice }),
      };
    }

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);
    return { items, total, page, limit };
  },

  async findById(companyId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return Product.findOne({ _id: id, company_id: companyId }).lean();
  },

  async create(companyId: string, data: ProductData) {
    const product = await Product.create({ ...data, company_id: companyId });
    return product.toObject();
  },

  async update(companyId: string, id: string, data: Partial<ProductData>) {
    if (!isValidObjectId(id)) return null;
    return Product.findOneAndUpdate({ _id: id, company_id: companyId }, data, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();
  },

  async clearImage(companyId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return Product.findOneAndUpdate(
      { _id: id, company_id: companyId },
      { $unset: { imageUrl: 1 } },
      { returnDocument: 'after' },
    ).lean();
  },

  async remove(companyId: string, id: string) {
    if (!isValidObjectId(id)) return false;
    const result = await Product.deleteOne({ _id: id, company_id: companyId });
    return result.deletedCount === 1;
  },

  async listCategories(companyId: string) {
    return Product.distinct('category', { company_id: companyId });
  },
};
