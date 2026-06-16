/**
 *
 * @param input
 * @returns
 */
export function parse(input: string): any {
  console.log("Parsing input:", input);
}

/**
 *
 * @param input
 * @returns
 */
export function stringify(input: any): string {
  return input;
}

/**
 * Represents the manifest file for a Zig project.
 */
interface Manifest {
  name: string;
  version: string;
  fingerprint: string;
  dependencies: Dependency[];
  minimumZigVersion: string;
  paths: [string];
}

/**
 * Represents the environment output by the Zig compiler when invoked with `zig env`.
 */
interface Environment {
  zig_env: string;
  lib_dir: string;
  std_dir: string;
  globalCacheDir: string;
  version: string;
  target: string;
  env: {
    zigGlobalCacheDir: string;
  };
}

type Dependency = PathDependency | PackageDependency;

interface PathDependency {
  path: string;
  url?: never;
  hash?: never;
}

interface PackageDependency {
  url: string;
  hash: string;

  path?: never;
}
