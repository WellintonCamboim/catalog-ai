import { BASE_URL } from '../api/client';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Uploaded images come back as "/uploads/..." (served by the API); external URLs pass through.
export const resolveImageUrl = (url: string | null): string =>
  url?.startsWith('/uploads/') ? `${BASE_URL}${url}` : (url ?? '');

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use uma imagem PNG, JPEG ou WebP';
  if (file.size > MAX_IMAGE_BYTES) return 'A imagem deve ter no máximo 2 MB';
  return null;
}
