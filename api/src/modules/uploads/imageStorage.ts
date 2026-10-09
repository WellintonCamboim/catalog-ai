import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import type { ImageExt } from './imageType.js';

// Where product images live. The product only stores the public path returned by `save`, so
// swapping the disk for S3/GCS means writing another implementation of this interface.
export interface ImageStorage {
  save(companyId: string, data: Buffer, ext: ImageExt): Promise<string>;
  /** Deletes a previously saved image. Paths that don't belong to the company are ignored. */
  delete(companyId: string, publicPath: string): Promise<void>;
}

const PUBLIC_PREFIX = '/uploads';
const FILE_NAME = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;

export function createLocalImageStorage(rootDir: string): ImageStorage {
  const root = path.resolve(rootDir);

  return {
    async save(companyId, data, ext) {
      const name = `${randomUUID()}.${ext}`;
      await mkdir(path.join(root, companyId), { recursive: true });
      await writeFile(path.join(root, companyId, name), data, { flag: 'wx' });
      return `${PUBLIC_PREFIX}/${companyId}/${name}`;
    },

    async delete(companyId, publicPath) {
      const prefix = `${PUBLIC_PREFIX}/${companyId}/`;
      if (!publicPath.startsWith(prefix)) return;
      const name = publicPath.slice(prefix.length);
      if (!FILE_NAME.test(name)) return;
      await rm(path.join(root, companyId, name), { force: true });
    },
  };
}

export const isLocalImage = (url: string | null | undefined): url is string =>
  !!url && url.startsWith(`${PUBLIC_PREFIX}/`);

export const imageStorage = createLocalImageStorage(env.UPLOAD_DIR);
