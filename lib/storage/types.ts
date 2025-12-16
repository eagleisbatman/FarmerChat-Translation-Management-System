export type StorageProvider = "local" | "r2" | "b2" | "spaces" | "vercel-blob";

export interface StorageConfig {
  provider: StorageProvider;
  // S3-compatible providers (R2, B2, Spaces)
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  // Vercel Blob
  vercelBlobToken?: string;
  // Public URL prefix (for CDN or custom domain)
  publicUrl?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
  thumbnailUrl?: string;
  thumbnailKey?: string;
}

export interface StorageAdapter {
  upload(file: Buffer, key: string, contentType: string): Promise<UploadResult>;
  uploadWithThumbnail?(file: Buffer, key: string, contentType: string, thumbnail: Buffer): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  deleteThumbnail?(key: string): Promise<void>;
  getUrl(key: string): string;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

