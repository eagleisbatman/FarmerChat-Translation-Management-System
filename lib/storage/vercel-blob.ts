import { put, del, head } from "@vercel/blob";
import type { StorageAdapter, UploadResult, StorageConfig } from "./types";

export class VercelBlobStorageAdapter implements StorageAdapter {
  private token: string;
  private baseUrl: string;

  constructor(config: StorageConfig) {
    if (!config.vercelBlobToken) {
      throw new Error("Vercel Blob token is required");
    }
    this.token = config.vercelBlobToken;
    this.baseUrl = config.publicUrl || "";
  }

  async upload(file: Buffer, key: string, contentType: string): Promise<UploadResult> {
    const blob = await put(key, file, {
      access: "public",
      contentType,
      token: this.token,
    });

    return {
      url: blob.url,
      key: blob.pathname,
      size: file.length,
      contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await del(key, { token: this.token });
  }

  getUrl(key: string): string {
    if (this.baseUrl) {
      return `${this.baseUrl}/${key}`;
    }
    // Vercel Blob returns full URLs from put(), so we should use the stored URL
    // For new uploads, the URL is returned from put()
    // For existing files, we need to construct it or use the stored URL
    // This is a fallback - ideally URLs should be stored in the database
    return key.startsWith("http") ? key : `https://blob.vercel-storage.com/${key}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    // Vercel Blob URLs are public, no signing needed
    return this.getUrl(key);
  }
}

