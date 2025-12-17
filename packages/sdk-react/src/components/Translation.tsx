"use client";

import React from "react";
import { useTranslation } from "../hooks/useTranslation";
import { UseTranslationOptions } from "../types";

export interface TranslationProps extends UseTranslationOptions {
  key: string;
  params?: Record<string, string | number>;
  fallback?: React.ReactNode;
  children?: (translation: string) => React.ReactNode;
}

/**
 * Translation component for rendering translated text
 * 
 * @example
 * ```tsx
 * <Translation key="welcome.message" />
 * <Translation key="greeting" params={{ name: "John" }} />
 * ```
 */
export function Translation({
  key: translationKey,
  params,
  fallback,
  children,
  ...options
}: TranslationProps) {
  const { t, isLoading } = useTranslation(options);
  const translation = t(translationKey, params);

  if (isLoading && fallback) {
    return <>{fallback}</>;
  }

  if (children) {
    return <>{children(translation)}</>;
  }

  return <>{translation}</>;
}

