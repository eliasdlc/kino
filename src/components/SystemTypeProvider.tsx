"use client";

import { createContext, useContext } from "react";
import {
  SYSTEM_TYPE_CONFIG,
  type SystemType,
  type SystemTypeConfig,
} from "@/shared/lib/system-types";

const SystemTypeContext = createContext(SYSTEM_TYPE_CONFIG);

export function SystemTypeProvider({ children }: { children: React.ReactNode }) {
  return (
    <SystemTypeContext.Provider value={SYSTEM_TYPE_CONFIG}>
      {children}
    </SystemTypeContext.Provider>
  );
}

export function useSystemTypeConfig(): typeof SYSTEM_TYPE_CONFIG {
  return useContext(SystemTypeContext);
}

export function useSystemTypeEntry(systemType: SystemType): SystemTypeConfig {
  const config = useContext(SystemTypeContext);
  return config[systemType];
}
