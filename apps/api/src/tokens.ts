// Explicit tokens: the esbuild-based toolchain emits no decorator metadata for type-based injection.
export const API_ENV = Symbol("API_ENV");
export const DATABASE = Symbol("DATABASE");
export const REPOSITORIES = Symbol("REPOSITORIES");
export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");
export const MALWARE_SCANNER = Symbol("MALWARE_SCANNER");
export const MEDIA_REGISTRY = Symbol("MEDIA_REGISTRY");
export const RETENTION_POLICY = Symbol("RETENTION_POLICY");
export const UPLOAD_POLICY = Symbol("UPLOAD_POLICY");
export const PURGE_PASS = Symbol("PURGE_PASS");
