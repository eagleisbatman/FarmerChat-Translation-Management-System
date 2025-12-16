import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import type { StorageAdapter, UploadResult } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;
  private publicUrl: string;

  constructor(publicUrl: string = "/uploads") {
    this.baseDir = join(process.cwd(), "public", "uploads");
    this.publicUrl = publicUrl;
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
    // Ensure directory exists
    try {
      await mkdir(this.baseDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    const filePath = join(this.baseDir, key);
    await writeFile(filePath, file);

    return {
      url: `${this.publicUrl}/${key}`,
      key,
      size: file.length,
      contentType,
    };
  }

  async uploadWithThumbnail(file: Buffer, key: string, contentType: string, thumbnail: Buffer): Promise<UploadResult> {
    const result = await this.upload(file, key, contentType);
    const thumbnailKey = `thumbnails/${key}`;
    const thumbnailResult = await this.upload(thumbnail, thumbnailKey, "image/webp");
    
    return {
      ...result,
      thumbnailUrl: thumbnailResult.url,
      thumbnailKey: thumbnailResult.key,
    };
  }

  async deleteThumbnail(key: string): Promise<void> {
    const thumbnailKey = `thumbnails/${key}`;
    await this.delete(thumbnailKey);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.baseDir, key);
    try {
      await unlink(filePath);
    } catch (error) {
      // File might not exist, ignore
      console.warn(`Failed to delete file ${key}:`, error);
    }
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    // Local storage doesn't need signed URLs
    return this.getUrl(key);
  }
}

