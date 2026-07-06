import {
  SYSTEM_TYPE_CONFIG,
  type ArchetypeManifest,
  type SystemType,
} from '@/shared/lib/system-types';

export function useSystemType(systemType: SystemType): ArchetypeManifest {
  return SYSTEM_TYPE_CONFIG[systemType];
}
