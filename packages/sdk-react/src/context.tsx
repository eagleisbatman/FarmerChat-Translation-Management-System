"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { LinguaFlowConfig } from "./types";

interface LinguaFlowContextValue {
  config: LinguaFlowConfig;
}

const LinguaFlowContext = createContext<LinguaFlowContextValue | null>(null);

export interface LinguaFlowProviderProps {
  config: LinguaFlowConfig;
  children: ReactNode;
}

/**
 * Provider component for LinguaFlow SDK
 * Wrap your app with this component to enable translation functionality
 */
export function LinguaFlowProvider({ config, children }: LinguaFlowProviderProps) {
  return (
    <LinguaFlowContext.Provider value={{ config }}>
      {children}
    </LinguaFlowContext.Provider>
  );
}

/**
 * Hook to access LinguaFlow configuration
 */
export function useLinguaFlowConfig(): LinguaFlowConfig {
  const context = useContext(LinguaFlowContext);
  if (!context) {
    throw new Error("useLinguaFlowConfig must be used within LinguaFlowProvider");
  }
  return context.config;
}

