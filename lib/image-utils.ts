import sharp from "sharp";

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "webp" | "jpeg" | "png" | "original";
}

export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 85,
    format = "webp",
  } = options;

  const sharpImage = sharp(buffer);
  const metadata = await sharpImage.metadata();

  // Resize if needed
  let resized = sharpImage;
  if (metadata.width && metadata.width > maxWidth) {
    resized = resized.resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: "inside",
    });
  } else if (metadata.height && metadata.height > maxHeight) {
    resized = resized.resize(null, maxHeight, {
      withoutEnlargement: true,
      fit: "inside",
    });
  }

  // Convert format
  let outputBuffer: Buffer;
  let contentType: string;
  let extension: string;

  if (format === "webp") {
    outputBuffer = await resized.webp({ quality, effort: 6 }).toBuffer();
    contentType = "image/webp";
    extension = "webp";
  } else if (format === "jpeg") {
    outputBuffer = await resized.jpeg({ quality, mozjpeg: true }).toBuffer();
    contentType = "image/jpeg";
    extension = "jpg";
  } else if (format === "png") {
    outputBuffer = await resized.png({ quality, compressionLevel: 9 }).toBuffer();
    contentType = "image/png";
    extension = "png";
  } else {
    // Keep original
    outputBuffer = await resized.toBuffer();
    contentType = metadata.format ? `image/${metadata.format}` : "image/jpeg";
    extension = metadata.format || "jpg";
  }

  return {
    buffer: outputBuffer,
    contentType,
    extension,
  };
}

export async function generateThumbnail(
  buffer: Buffer,
  size: number = 200
): Promise<Buffer> {
  return await sharp(buffer)
    .resize(size, size, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 80 })
    .toBuffer();
}

