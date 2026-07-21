/**
 * Represents a Zig enum literal (e.g., `.docent` or `.@"some name"`).
 */
export class EnumLiteral {
  /** The value of the enum literal (without the leading dot). */
  public readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return `.${this.value}`;
  }

  toJSON(): string {
    return `.${this.value}`;
  }
}

/**
 * Represents a Zig character literal (e.g., `'a'` or `'\n'`).
 */
export class CharLiteral {
  /** The value of the character literal (without the quotes). */
  public readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return `'${this.value}'`;
  }

  toJSON(): string {
    return this.value;
  }
}

/** Options for parsing ZON. */
export interface ParseOptions {
  /**
   * How to represent enum literals.
   * - 'class' (default): returns an instance of EnumLiteral
   * - 'string': returns a string (e.g., 'docent')
   * - 'prefix': returns a string prefixed with a dot (e.g., '.docent')
   */
  enumLiteral?: "class" | "string" | "prefix";

  /**
   * How to represent character literals.
   * - 'class' (default): returns an instance of CharLiteral
   * - 'string': returns a string of length 1 (e.g., 'a')
   * - 'number': returns the character code integer (e.g., 97)
   */
  charLiteral?: "class" | "string" | "number";

  /**
   * How to represent integers that exceed safe limits.
   * - 'bigint' (default): returns a BigInt
   * - 'number': returns a number (may lose precision)
   * - 'string': returns the string representation
   */
  bigint?: "bigint" | "number" | "string";
}

/** Represents a JSON-compatible ZON value. */
export type ZonValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | EnumLiteral
  | CharLiteral
  | ZonValue[]
  | { [key: string]: ZonValue };

/** Options for stringifying ZON. */
export interface StringifyOptions {
  /**
   * Adds indentation, white space, and line break characters to the return-value ZON text.
   * If it is a number, it specifies the number of spaces for indentation.
   * If it is a string, the string is used as the indentation.
   */
  space?: string | number;

  /**
   * A function that transforms the results.
   */
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
}

/**
 * Represents the manifest file for a Zig project.
 *
 * See <https://codeberg.org/ziglang/zig/src/tag/0.16.0/doc/build.zig.zon.md>.
 */
export interface Manifest {
  name: string;
  version: string;
  fingerprint: string | bigint;
  dependencies: Record<string, Dependency>;
  minimumZigVersion: string;
  paths: string[];
}

/**
 * Represents the environment output by the Zig compiler when invoked with `zig env`.
 *
 * See <https://ziglang.org/documentation/0.16.0/std/#std.zig.EnvVar>
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
