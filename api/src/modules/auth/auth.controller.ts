import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export async function register(req: Request, res: Response) {
  res.status(201).json(await authService.register(req.body as RegisterInput));
}

export async function login(req: Request, res: Response) {
  res.json(await authService.login(req.body as LoginInput));
}

export async function me(req: Request, res: Response) {
  const { userId, companyId } = req.auth!;
  res.json(await authService.getProfile(userId, companyId));
}
