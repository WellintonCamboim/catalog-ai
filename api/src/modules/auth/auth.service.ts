import bcrypt from 'bcryptjs';
import { conflict, notFound, unauthorized } from '../../lib/errors.js';
import { Company } from '../companies/company.model.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { signToken } from './token.js';
import { User, type UserDoc } from './user.model.js';

const BCRYPT_COST = 10;
// Hash descartável: login de e-mail inexistente gasta o mesmo tempo que um existente.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_COST);

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserDoc['role'];
  companyId: string;
};

function toPublicUser(u: {
  _id: unknown;
  name: string;
  email: string;
  role: UserDoc['role'];
  company_id: unknown;
}): PublicUser {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    companyId: String(u.company_id),
  };
}

function issue(user: PublicUser) {
  const token = signToken({ userId: user.id, companyId: user.companyId, role: user.role });
  return { token, user };
}

export async function register(input: RegisterInput) {
  if (await User.exists({ email: input.email })) throw conflict('E-mail já cadastrado');

  let companyId: string;
  let role: UserDoc['role'];
  let createdCompanyId: string | null = null;

  if (input.inviteCode) {
    const company = await Company.findOne({ inviteCode: input.inviteCode });
    if (!company) throw notFound('Código de convite inválido');
    companyId = String(company._id);
    role = 'user';
  } else {
    const company = await Company.create({ name: input.companyName });
    companyId = createdCompanyId = String(company._id);
    role = 'admin';
  }

  try {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role,
      company_id: companyId,
    });
    return issue(toPublicUser(user));
  } catch (err) {
    // Sem transação (Mongo standalone): desfaz a empresa recém-criada.
    if (createdCompanyId) await Company.deleteOne({ _id: createdCompanyId });
    if ((err as { code?: number }).code === 11000) throw conflict('E-mail já cadastrado');
    throw err;
  }
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Credenciais inválidas');
  return issue(toPublicUser(user));
}

export async function getProfile(userId: string, companyId: string) {
  const user = await User.findOne({ _id: userId, company_id: companyId });
  if (!user) throw unauthorized('Usuário não encontrado');
  const company = await Company.findById(companyId);
  if (!company) throw unauthorized('Empresa não encontrada');
  return {
    user: toPublicUser(user),
    company: {
      id: String(company._id),
      name: company.name,
      // O código de convite é segredo de admin.
      ...(user.role === 'admin' ? { inviteCode: company.inviteCode } : {}),
    },
  };
}
