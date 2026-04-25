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
import { extname } from 'path';

// Inline type to avoid relying on the Express.Multer global namespace augmentation
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

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly maxFileSizeBytes: number;

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('WASABI_REGION');
    const endpoint = this.config.getOrThrow<string>('WASABI_ENDPOINT');
    const accessKeyId = this.config.getOrThrow<string>('WASABI_ACCESS_KEY_ID');
    const secretAccessKey = this.config.getOrThrow<string>('WASABI_SECRET_ACCESS_KEY');
    this.bucket = this.config.getOrThrow<string>('WASABI_BUCKET_NAME');
    const maxMb = Number(this.config.get<string>('MAX_FILE_SIZE_MB') ?? '10');
    this.maxFileSizeBytes = (Number.isFinite(maxMb) ? maxMb : 10) * 1024 * 1024;

    this.s3 = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  get maxFileSize(): number {
    return this.maxFileSizeBytes;
  }

  async uploadFile(file: MulterFile, folder: string): Promise<UploadedFile> {
    const ext = extname(file.originalname).toLowerCase();
    const key = `${folder}/${randomUUID()}${ext}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
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
      url: await this.getSignedUrl(key),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      originalName: file.originalname,
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    // Double cast required: pnpm resolves separate copies of @smithy internals across SDK packages
    return getSignedUrl(this.s3 as unknown as Parameters<typeof getSignedUrl>[0], command, {
      expiresIn: expiresInSeconds,
    });
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to delete file: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
