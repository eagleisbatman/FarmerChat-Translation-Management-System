/**
 * Centralized error handling utilities
 * Provides user-friendly error messages and error types
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public userMessage?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(message, "VALIDATION_ERROR", 400, userMessage || "Invalid input. Please check your data and try again.");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required", userMessage?: string) {
    super(message, "AUTH_ERROR", 401, userMessage || "Please sign in to continue.");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied", userMessage?: string) {
    super(message, "AUTHORIZATION_ERROR", 403, userMessage || "You don't have permission to perform this action.");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, userMessage?: string) {
    super(`${resource} not found`, "NOT_FOUND", 404, userMessage || `The requested ${resource} could not be found.`);
    this.name = "NotFoundError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, userMessage?: string) {
    super(`${service} error: ${message}`, "EXTERNAL_SERVICE_ERROR", 502, userMessage || `The ${service} service is temporarily unavailable. Please try again later.`);
    this.name = "ExternalServiceError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded", userMessage?: string) {
    super(message, "RATE_LIMIT", 429, userMessage || "Too many requests. Please wait a moment and try again.");
    this.name = "RateLimitError";
  }
}

/**
 * Handle API errors and return user-friendly responses
 */
export function handleApiError(error: unknown): {
  error: string;
  code?: string;
  statusCode: number;
  userMessage?: string;
  details?: unknown;
} {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      userMessage: error.userMessage,
    };
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes("ECONNREFUSED") || error.message.includes("ETIMEDOUT")) {
      return {
        error: "Connection failed",
        code: "CONNECTION_ERROR",
        statusCode: 503,
        userMessage: "Unable to connect to the service. Please check your internet connection and try again.",
      };
    }

    if (error.message.includes("API key") || error.message.includes("authentication")) {
      return {
        error: "Authentication failed",
        code: "AUTH_ERROR",
        statusCode: 401,
        userMessage: "Invalid API credentials. Please check your API key configuration.",
      };
    }

    if (error.message.includes("quota") || error.message.includes("limit")) {
      return {
        error: "Quota exceeded",
        code: "QUOTA_ERROR",
        statusCode: 429,
        userMessage: "API quota exceeded. Please check your API usage limits or try again later.",
      };
    }

    return {
      error: error.message,
      statusCode: 500,
      userMessage: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    };
  }

  return {
    error: "Unknown error",
    statusCode: 500,
    userMessage: "An unexpected error occurred. Please try again.",
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown) {
  const handled = handleApiError(error);
  return {
    error: handled.error,
    code: handled.code,
    message: handled.userMessage || handled.error,
    ...(process.env.NODE_ENV === "development" && { details: error }),
  };
}

