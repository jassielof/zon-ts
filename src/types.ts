/**
 * Type definitions, data structures, and AST representations for Zig Object Notation (ZON).
 *
 * @module
 */

/**
 * Represents a Zig enum literal (e.g., `.docent` or `.@"some name"`).
 */
export class EnumLiteral {
  /** The value of the enum literal (without the leading dot). */
  public readonly value: string;

  /**
   * Creates a new EnumLiteral instance.
   * @param value The value of the enum literal (without the leading dot).
   */
  constructor(value: string) {
    this.value = value;
  }

  /**
   * Returns the ZON string representation with the leading dot (e.g., `.docent`).
   */
  toString(): string {
    return `.${this.value}`;
  }

  /**
   * Returns the serialized JSON string representation.
   */
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

  /**
   * Creates a new CharLiteral instance.
   * @param value A string containing exactly one Unicode scalar value.
   */
  constructor(value: string) {
    const codePoint = value.codePointAt(0);
    if (
      Array.from(value).length !== 1 || codePoint === undefined ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      throw new TypeError(
        "CharLiteral requires exactly one Unicode scalar value",
      );
    }
    this.value = value;
  }

  /**
   * Returns the ZON string representation enclosed in single quotes (e.g., `'a'`).
   */
  toString(): string {
    return `'${this.value}'`;
  }

  /**
   * Returns the serialized JSON string representation.
   */
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
  /** The package name. */
  name: string | EnumLiteral;
  /** The semver version of the package. */
  version: string;
  /** The package fingerprint. */
  fingerprint: number | bigint;
  /** Package dependencies mapping. */
  dependencies: Record<string, Dependency>;
  /** Minimum Zig compiler version required. */
  minimum_zig_version?: string;
  /** Mach engine Zig version required, if applicable. */
  mach_zig_version?: string;
  /** List of paths included in the package. */
  paths: string[];
}

/**
 * Represents the environment output by the Zig compiler when invoked with `zig env`.
 *
 * See <https://ziglang.org/documentation/0.16.0/std/#std.zig.EnvVar>
 */
export interface Environment {
  /** Path to the Zig executable. */
  zig_exe: string;
  /** Path to the Zig lib directory. */
  lib_dir: string;
  /** Path to the Zig standard library directory. */
  std_dir: string;
  /** Path to the global Zig cache directory. */
  global_cache_dir: string;
  /** The Zig compiler version string. */
  version: string;
  /** The target triple string. */
  target: string;
  /** Map of environment variables reported by `zig env`. */
  env: Record<string, string | null>;
}

/**
 * Represents a dependency in a Zig package manifest (`build.zig.zon`).
 */
export type Dependency = PathDependency | PackageDependency;

/**
 * A local path-based dependency in `build.zig.zon`.
 */
export interface PathDependency {
  /** Relative or absolute filesystem path to the dependency. */
  path: string;
  /** Not defined for path-based dependencies. */
  url?: never;
  /** Not defined for path-based dependencies. */
  hash?: never;
}

/**
 * A remote URL/hash package dependency in `build.zig.zon`.
 */
export interface PackageDependency {
  /** URL to the dependency tarball or repository. */
  url: string;
  /** Expected cryptographic package multihash. */
  hash: string;
  /** Not defined for package-based dependencies. */
  path?: never;
}
