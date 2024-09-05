export interface GuidProvider {
  generate(): string;
}

export const GUID_PROVIDER = Symbol('GuidProvider');
