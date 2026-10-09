import { Schema, model, type InferSchemaType } from 'mongoose';
import { tenantScope } from '../../lib/tenantScope.js';

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true, maxlength: 60 },
    imageUrl: { type: String, trim: true, maxlength: 500 },
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  },
  { timestamps: true },
);

productSchema.index({ company_id: 1, createdAt: -1 });
productSchema.index({ company_id: 1, category: 1 });
productSchema.plugin(tenantScope);

export type ProductDoc = InferSchemaType<typeof productSchema>;
export const Product = model('Product', productSchema);
