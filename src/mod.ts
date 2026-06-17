export { parse } from "./parser.ts";
export { stringify } from "./serializer.ts";
export {
  CharLiteral,
  EnumLiteral,
  type ParseOptions,
  type StringifyOptions,
  type ZonValue,
} from "./types.ts";

/**
 * Represents the manifest file for a Zig project.
 */
export interface Manifest {
  name: string;
  version: string;
  fingerprint: string | bigint;
  dependencies: Dependency[];
  minimumZigVersion: string;
  paths: string[];
}

/**
 * Represents the environment output by the Zig compiler when invoked with `zig env`.
 */
export interface Environment {
  zig_exe: string;
  lib_dir: string;
  std_dir: string;
  global_cache_dir: string;
  version: string;
  target: string;
  env: Record<string, string | null>;
}

export type Dependency = PathDependency | PackageDependency;

export interface PathDependency {
  path: string;
  url?: never;
  hash?: never;
}

export interface PackageDependency {
  url: string;
  hash: string;
  path?: never;
}
