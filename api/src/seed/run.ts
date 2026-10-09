import bcrypt from 'bcryptjs';
import { Company } from '../modules/companies/company.model.js';
import { User } from '../modules/auth/user.model.js';
import { Product } from '../modules/products/product.model.js';
import { companies, DEMO_PASSWORD } from './data.js';

// Re-running resets the demo companies' catalogs instead of duplicating them.
export async function runSeed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const summary = [];

  for (const data of companies) {
    const company = await Company.findOneAndUpdate(
      { name: data.name },
      { name: data.name, inviteCode: data.inviteCode },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const accounts = [
      { role: 'admin', email: `admin@${data.slug}.example`, name: `Admin ${data.name}` },
      { role: 'user', email: `user@${data.slug}.example`, name: `Cliente ${data.name}` },
    ] as const;

    for (const account of accounts) {
      await User.findOneAndUpdate(
        { email: account.email },
        { ...account, passwordHash, company_id: company._id },
        { upsert: true },
      );
    }

    await Product.deleteMany({ company_id: company._id });
    await Product.insertMany(
      data.products.map((p) => ({
        ...p,
        company_id: company._id,
        imageUrl: `https://picsum.photos/seed/${data.slug}-${encodeURIComponent(p.name)}/600/400`,
      })),
    );

    summary.push({
      company: data.name,
      products: data.products.length,
      inviteCode: data.inviteCode,
      accounts: accounts.map((a) => `${a.role}: ${a.email}`),
    });
  }

  return summary;
}
