import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError, badRequest } from '../../lib/errors.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Memory storage is fine for a 2 MB cap and lets the file be validated before touching the disk.
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
}).single('image');

export const uploadImage: RequestHandler = (req, res, next) => {
  parser(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'Imagem muito grande (máximo 2 MB)'));
      }
      return next(badRequest('Envie um único arquivo no campo "image"'));
    }
    next(err);
  });
};
