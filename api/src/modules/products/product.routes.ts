import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { uploadImage } from '../uploads/upload.middleware.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './product.controller.js';
import { createProductSchema, listProductsSchema, updateProductSchema } from './product.schemas.js';

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get('/', validate(listProductsSchema, 'query'), controller.list);
productRouter.get('/categories', controller.categories);
productRouter.get('/:id', controller.get);

productRouter.post('/', requireRole('admin'), validate(createProductSchema), controller.create);
productRouter.put('/:id', requireRole('admin'), validate(updateProductSchema), controller.update);
productRouter.delete('/:id', requireRole('admin'), controller.remove);

productRouter.put('/:id/image', requireRole('admin'), uploadImage, controller.setImage);
productRouter.delete('/:id/image', requireRole('admin'), controller.removeImage);
