import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve } from 'path';

export type StoredObject = { key: string; sizeBytes: number };

@Injectable()
export class DocumentStorageService {
  private readonly driver: 'local' | 'gcs';
  private readonly localRoot: string;
  private readonly bucketName?: string;
  private readonly gcs?: Storage;

  constructor(config: ConfigService) {
    this.driver =
      config.get('DOCUMENT_STORAGE_DRIVER', 'local') === 'gcs'
        ? 'gcs'
        : 'local';
    this.localRoot = resolve(
      config.get(
        'DOCUMENT_STORAGE_LOCAL_ROOT',
        join(process.cwd(), 'private-storage'),
      ),
    );
    this.bucketName = config.get<string>('DOCUMENT_STORAGE_GCS_BUCKET');
    if (this.driver === 'gcs') {
      if (!this.bucketName)
        throw new Error(
          'DOCUMENT_STORAGE_GCS_BUCKET is required for GCS storage.',
        );
      this.gcs = new Storage();
    }
  }

  async put(
    key: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const safeKey = this.safeKey(key);
    if (this.driver === 'gcs') {
      await this.gcs!.bucket(this.bucketName!)
        .file(safeKey)
        .save(bytes, {
          resumable: false,
          contentType,
          metadata: { cacheControl: 'private, no-store' },
        });
    } else {
      const target = join(this.localRoot, safeKey);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    return { key: safeKey, sizeBytes: bytes.length };
  }

  async get(key: string): Promise<Buffer> {
    const safeKey = this.safeKey(key);
    try {
      if (this.driver === 'gcs') {
        const [bytes] = await this.gcs!.bucket(this.bucketName!)
          .file(safeKey)
          .download();
        return bytes;
      }
      return await readFile(join(this.localRoot, safeKey));
    } catch {
      throw new NotFoundException('Private document file was not found.');
    }
  }

  async delete(key: string) {
    const safeKey = this.safeKey(key);
    if (this.driver === 'gcs') {
      await this.gcs!.bucket(this.bucketName!)
        .file(safeKey)
        .delete({ ignoreNotFound: true });
      return;
    }
    await unlink(join(this.localRoot, safeKey)).catch(() => undefined);
  }

  async signedDownloadUrl(key: string, expiresInSeconds = 300) {
    const safeKey = this.safeKey(key);
    if (this.driver !== 'gcs') return null;
    const [url] = await this.gcs!.bucket(this.bucketName!)
      .file(safeKey)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + Math.min(expiresInSeconds, 900) * 1000,
        version: 'v4',
      });
    return url;
  }

  private safeKey(key: string) {
    const cleaned = normalize(key.replaceAll('\\', '/')).replace(/^\/+/, '');
    if (!cleaned || cleaned.startsWith('..') || cleaned.includes('/../')) {
      throw new Error('Invalid private storage key.');
    }
    return cleaned;
  }
}
