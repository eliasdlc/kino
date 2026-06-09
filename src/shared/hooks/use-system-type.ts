import {
  SYSTEM_TYPE_CONFIG,
  type SystemType,
  type SystemTypeConfig,
} from '@/shared/lib/system-types';

export function useSystemType(systemType: SystemType): SystemTypeConfig {
  return SYSTEM_TYPE_CONFIG[systemType];
}

export function getRequiredFieldsFor(systemType: SystemType): string[] {
  return SYSTEM_TYPE_CONFIG[systemType].extraFields;
}
