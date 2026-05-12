import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { extname, dirname, resolve, sep } from 'path';
import type { Readable } from 'stream';
import type { UploadResourceType } from '../prisma/prisma.service';

type MulterFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type UploadedFile = {
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
};

export type DownloadedFile = {
  body: Readable;
  contentType: string | undefined;
  contentLength: number;
};

@Injectable()
export class StorageService {
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly maxFileSizeBytes: number;
  private readonly allowedImageTypes: string[];
  private readonly allowedDocTypes: string[];
  private readonly assetsRoot: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const maxMb = Number(this.config.get<string>('MAX_FILE_SIZE_MB') ?? '10');
    this.maxFileSizeBytes = (Number.isFinite(maxMb) ? maxMb : 10) * 1024 * 1024;
    this.assetsRoot = resolve(process.cwd(), 'assets');
    this.publicBaseUrl = (
      this.config.get<string>('BACKEND_APP_URL') ??
      `http://localhost:${this.config.get<string>('PORT') ?? '3000'}`
    ).replace(/\/+$/, '');

    const parseList = (key: string, fallback: string) =>
      (this.config.get<string>(key) ?? fallback)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    this.allowedImageTypes = parseList('ALLOWED_IMAGE_TYPES', 'image/jpeg,image/png');
    this.allowedDocTypes = parseList(
      'ALLOWED_DOC_TYPES',
      'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/zip,application/x-zip-compressed,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,audio/mpeg,audio/wav,audio/webm,audio/ogg,audio/mp4',
    );

    const region = this.config.get<string>('WASABI_REGION');
    const endpoint = this.config.get<string>('WASABI_ENDPOINT');
    const accessKeyId = this.config.get<string>('WASABI_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('WASABI_SECRET_ACCESS_KEY');
    this.bucket = this.config.get<string>('WASABI_BUCKET_NAME') ?? null;

    this.s3 =
      region && endpoint && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            region,
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
          })
        : null;
  }

  get maxFileSize(): number {
    return this.maxFileSizeBytes;
  }

  isAllowedMimeType(mimeType: string): boolean {
    return this.allowedImageTypes.includes(mimeType) || this.allowedDocTypes.includes(mimeType);
  }

  isImageMimeType(mimeType: string): boolean {
    return this.allowedImageTypes.includes(mimeType);
  }

  async uploadFile(
    file: MulterFile,
    folder: string,
    provider: UploadResourceType,
  ): Promise<UploadedFile> {
    const ext = extname(file.originalname).toLowerCase();
    const key = `${folder}/${randomUUID()}${ext}`;

    if (provider === 'SERVER_STORAGE') {
      const fullPath = this.resolveAssetPath(key);

      try {
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, file.buffer);
      } catch (err) {
        throw new InternalServerErrorException(
          `Failed to store file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return {
        key,
        url: this.buildAssetUrl(key),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        originalName: file.originalname,
      };
    }

    const s3 = this.getS3Client();

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: this.bucket as string,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
        }),
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to upload file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      key,
      url: await this.getAccessibleUrl(key, provider),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      originalName: file.originalname,
    };
  }

  async getAccessibleUrl(
    key: string,
    provider: UploadResourceType,
    expiresInSeconds = 86400,
  ): Promise<string> {
    if (provider === 'SERVER_STORAGE') {
      return this.buildAssetUrl(key);
    }

    const s3 = this.getS3Client();
    const command = new GetObjectCommand({ Bucket: this.bucket as string, Key: key });
    // Double cast required: pnpm resolves separate copies of @smithy internals across SDK packages
    return getSignedUrl(s3 as unknown as Parameters<typeof getSignedUrl>[0], command, {
      expiresIn: expiresInSeconds,
    });
  }

  async downloadFile(
    key: string,
    provider: UploadResourceType,
  ): Promise<DownloadedFile> {
    if (provider === 'SERVER_STORAGE') {
      const fullPath = this.resolveAssetPath(key);

      try {
        const fileStats = await stat(fullPath);

        return {
          body: createReadStream(fullPath),
          contentType: undefined,
          contentLength: fileStats.size,
        };
      } catch (err) {
        throw new InternalServerErrorException(
          `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const s3 = this.getS3Client();

    try {
      const result = await s3.send(new GetObjectCommand({ Bucket: this.bucket as string, Key: key }));
      const body = result.Body as Readable | undefined;

      if (!body) {
        throw new Error('Empty file body received from storage');
      }

      return {
        body,
        contentType: result.ContentType,
        contentLength: result.ContentLength ?? 0,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to download file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async deleteFile(key: string, provider: UploadResourceType): Promise<void> {
    if (provider === 'SERVER_STORAGE') {
      try {
        await unlink(this.resolveAssetPath(key));
        return;
      } catch (err) {
        throw new InternalServerErrorException(
          `Failed to delete file: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const s3 = this.getS3Client();

    try {
      await s3.send(new DeleteObjectCommand({ Bucket: this.bucket as string, Key: key }));
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to delete file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private getS3Client(): S3Client {
    if (!this.s3 || !this.bucket) {
      throw new InternalServerErrorException('Wasabi S3 storage is not configured');
    }

    return this.s3;
  }

  private resolveAssetPath(key: string): string {
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = resolve(this.assetsRoot, normalizedKey);

    if (fullPath !== this.assetsRoot && !fullPath.startsWith(`${this.assetsRoot}${sep}`)) {
      throw new InternalServerErrorException('Invalid asset path');
    }

    return fullPath;
  }

  private buildAssetUrl(key: string): string {
    const encodedKey = key
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');

    return `${this.publicBaseUrl}/assets/${encodedKey}`;
  }
}
