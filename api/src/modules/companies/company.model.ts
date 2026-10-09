import { randomBytes } from 'node:crypto';
import { Schema, model, type InferSchemaType } from 'mongoose';

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Código que o admin compartilha para convidar usuários (role "user") para a empresa.
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      default: () => randomBytes(6).toString('hex'),
    },
  },
  { timestamps: true },
);

export type CompanyDoc = InferSchemaType<typeof companySchema>;
export const Company = model('Company', companySchema);
