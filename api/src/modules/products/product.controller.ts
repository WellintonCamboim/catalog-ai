import type { Request, Response } from 'express';
import type {
  CreateProductInput,
  ListProductsInput,
  UpdateProductInput,
} from './product.schemas.js';
import { productService } from './product.service.js';

// companyId always comes from the verified JWT (req.auth), never from the request payload.
const tenant = (req: Request) => req.auth!.companyId;
const idParam = (req: Request) => String(req.params.id);

export async function list(req: Request, res: Response) {
  res.json(await productService.list(tenant(req), req.query as unknown as ListProductsInput));
}

export async function categories(req: Request, res: Response) {
  res.json({ items: await productService.categories(tenant(req)) });
}

export async function get(req: Request, res: Response) {
  res.json(await productService.get(tenant(req), idParam(req)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await productService.create(tenant(req), req.body as CreateProductInput));
}

export async function update(req: Request, res: Response) {
  res.json(await productService.update(tenant(req), idParam(req), req.body as UpdateProductInput));
}

export async function remove(req: Request, res: Response) {
  await productService.remove(tenant(req), idParam(req));
  res.status(204).end();
}
