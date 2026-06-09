import {
  SYSTEM_TYPE_CONFIG,
  type SystemType,
  type SystemStatusDef,
  type SystemTypeConfig,
} from '@/shared/lib/system-types';

export function useSystemType(systemType: SystemType): SystemTypeConfig {
  return SYSTEM_TYPE_CONFIG[systemType];
}

export function getValidStatusesFor(systemType: SystemType): SystemStatusDef[] {
  return SYSTEM_TYPE_CONFIG[systemType].statuses;
}

export function getValidStatusNamesFor(systemType: SystemType): string[] {
  return SYSTEM_TYPE_CONFIG[systemType].statuses.map((s) => s.name);
}

export function getRequiredFieldsFor(systemType: SystemType): string[] {
  return SYSTEM_TYPE_CONFIG[systemType].extraFields;
}

export function isValidStatusFor(systemType: SystemType, status: string): boolean {
  return getValidStatusNamesFor(systemType).includes(status);
}
