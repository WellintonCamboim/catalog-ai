import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));
const password = z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(72);

// Ou cria uma empresa nova (vira admin), ou entra numa existente via código de convite (vira user).
export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email,
    password,
    companyName: z.string().trim().min(2).max(120).optional(),
    inviteCode: z.string().trim().min(1).optional(),
  })
  .refine((d) => Boolean(d.companyName) !== Boolean(d.inviteCode), {
    message:
      'Informe companyName (nova empresa) ou inviteCode (entrar em uma existente), não ambos',
    path: ['companyName'],
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
