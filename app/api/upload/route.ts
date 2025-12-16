import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { optimizeImage } from "@/lib/image-utils";
import { nanoid } from "nanoid";
import { formatErrorResponse, ValidationError, AuthenticationError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

        if (!session) {
          throw new AuthenticationError();
        }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const keyId = formData.get("keyId") as string;

    if (!file) {
      throw new ValidationError("No file provided", "Please select a file to upload.");
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      throw new ValidationError(
        "Invalid file type",
        "Only image files (JPEG, PNG, WebP, SVG) are allowed."
      );
    }

    // Validate file size (max 5MB before optimization)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new ValidationError(
        "File too large",
        "Maximum file size is 5MB. Please compress your image and try again."
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let contentType = file.type;
    let fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";

    // Optimize image with Sharp (skip SVG)
    if (file.type !== "image/svg+xml" && file.type.startsWith("image/")) {
      try {
        const optimized = await optimizeImage(buffer, { format: "webp", quality: 85 });
        buffer = optimized.buffer;
        contentType = optimized.contentType;
        fileExtension = optimized.extension;
      } catch (error) {
        console.warn("Image optimization failed, using original:", error);
        // Continue with original buffer if optimization fails
      }
    }

    // Generate unique filename
    const fileName = `${nanoid()}.${fileExtension}`;

    // Upload to storage (cloud or local)
    const result = await storage.uploadFile(fileName, buffer, contentType);

    return NextResponse.json({
      url: result.url,
      fileName: file.name,
      size: result.size,
      type: result.contentType,
    });
      } catch (error) {
        console.error("Error uploading file:", error);
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
      }
}

