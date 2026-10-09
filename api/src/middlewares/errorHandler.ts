import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, notFound } from '../lib/errors.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound('Rota não encontrada'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }
  if (env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { message: 'Erro interno do servidor' } });
};
