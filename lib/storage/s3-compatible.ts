import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { StorageAdapter, UploadResult, StorageConfig } from "./types";

export class S3CompatibleStorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
      forcePathStyle: config.provider === "b2", // Backblaze B2 requires path-style
    });
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    await this.client.send(command);

    const url = this.publicUrl
      ? `${this.publicUrl}/${key}`
      : this.getUrl(key);

    return {
      url,
      key,
      size: file.length,
      contentType,
    };
  }

  async uploadWithThumbnail(file: Buffer, key: string, contentType: string, thumbnail: Buffer): Promise<UploadResult> {
    const result = await this.upload(file, key, contentType);
    
    const thumbnailKey = `thumbnails/${key}`;
    const thumbnailCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: "image/webp",
    });

    await this.client.send(thumbnailCommand);

    const thumbnailUrl = this.publicUrl
      ? `${this.publicUrl}/${thumbnailKey}`
      : this.getUrl(thumbnailKey);

    return {
      ...result,
      thumbnailUrl,
      thumbnailKey,
    };
  }

  async deleteThumbnail(key: string): Promise<void> {
    const thumbnailKey = `thumbnails/${key}`;
    await this.delete(thumbnailKey);
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  getUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    // Fallback to S3 URL format
    const endpoint = this.client.config.endpoint?.toString() || "";
    if (endpoint.includes("r2.cloudflarestorage.com")) {
      // Cloudflare R2 public URL format
      return `https://pub-${this.bucket}.r2.dev/${key}`;
    }
    return `${endpoint}/${this.bucket}/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }
}

