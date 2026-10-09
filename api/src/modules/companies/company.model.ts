import { randomBytes } from 'node:crypto';
import { Schema, model, type InferSchemaType } from 'mongoose';

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Shared by the admin to invite users (role "user") into the company.
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
