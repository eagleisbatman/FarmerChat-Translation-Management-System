import type { StorageAdapter, StorageConfig, StorageProvider } from "./types";
import { LocalStorageAdapter } from "./local";
import { S3CompatibleStorageAdapter } from "./s3-compatible";
import { VercelBlobStorageAdapter } from "./vercel-blob";

export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.provider) {
    case "local":
      return new LocalStorageAdapter(config.publicUrl);

    case "r2":
    case "b2":
    case "spaces":
      if (!config.accessKeyId || !config.secretAccessKey || !config.bucket) {
        throw new Error(
          `Missing required config for ${config.provider}: accessKeyId, secretAccessKey, bucket`
        );
      }
      return new S3CompatibleStorageAdapter(config);

    case "vercel-blob":
      if (!config.vercelBlobToken) {
        throw new Error("Missing required config for vercel-blob: vercelBlobToken");
      }
      return new VercelBlobStorageAdapter(config);

    default:
      throw new Error(`Unsupported storage provider: ${config.provider}`);
  }
}

export function getStorageConfig(): StorageConfig {
  const provider = (process.env.STORAGE_PROVIDER || "local") as StorageProvider;

  const baseConfig: StorageConfig = {
    provider,
    bucket: process.env.STORAGE_BUCKET || "",
  };

  switch (provider) {
    case "r2":
      return {
        ...baseConfig,
        provider: "r2",
        endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        region: process.env.R2_REGION || "auto",
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET_NAME || baseConfig.bucket,
        publicUrl: process.env.R2_PUBLIC_URL, // Optional: Custom domain/CDN
      };

    case "b2":
      return {
        ...baseConfig,
        provider: "b2",
        endpoint: process.env.B2_ENDPOINT || "https://s3.us-west-002.backblazeb2.com",
        region: process.env.B2_REGION || "us-west-002",
        accessKeyId: process.env.B2_APPLICATION_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
        bucket: process.env.B2_BUCKET_NAME || baseConfig.bucket,
        publicUrl: process.env.B2_PUBLIC_URL,
      };

    case "spaces":
      return {
        ...baseConfig,
        provider: "spaces",
        endpoint: process.env.SPACES_ENDPOINT || `https://${process.env.SPACES_REGION || "nyc3"}.digitaloceanspaces.com`,
        region: process.env.SPACES_REGION || "nyc3",
        accessKeyId: process.env.SPACES_ACCESS_KEY_ID,
        secretAccessKey: process.env.SPACES_SECRET_ACCESS_KEY,
        bucket: process.env.SPACES_BUCKET_NAME || baseConfig.bucket,
        publicUrl: process.env.SPACES_PUBLIC_URL,
      };

    case "vercel-blob":
      return {
        ...baseConfig,
        provider: "vercel-blob",
        vercelBlobToken: process.env.BLOB_READ_WRITE_TOKEN,
        publicUrl: process.env.BLOB_PUBLIC_URL,
      };

    case "local":
    default:
      return {
        ...baseConfig,
        provider: "local",
        publicUrl: process.env.LOCAL_STORAGE_PUBLIC_URL || "/uploads",
      };
  }
}

// Singleton instance
let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    const config = getStorageConfig();
    storageAdapter = createStorageAdapter(config);
  }
  return storageAdapter;
}

