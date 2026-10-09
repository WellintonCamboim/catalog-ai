import { z } from 'zod';

const imageUrl = z.url({ protocol: /^https?$/ }).max(500);

// strictObject rejects unknown keys, so a client can never smuggle company_id in the body.
export const createProductSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  price: z.number().min(0).max(1_000_000),
  category: z.string().trim().min(1).max(60),
  imageUrl: imageUrl.optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo' });

export const listProductsSchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice não pode ser maior que maxPrice',
    path: ['minPrice'],
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
