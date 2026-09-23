/**
 * Type definitions, data structures, and AST representations for Zig Object Notation (ZON).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zon|Zig's ZON module}
 *
 * @module
 */

/**
 * Represents a Zig enum literal (e.g., `.docent` or `.@"some name"`).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/#Enum-Literals}
 */
export class EnumLiteral {
  /**
   * The value of the enum literal (without the leading dot).
   * @readonly
   */
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
   * @returns The formatted enum literal string.
   */
  toString(): string {
    return `.${this.value}`;
  }

  /**
   * Returns the serialized JSON string representation.
   * @returns The JSON-compatible string representation.
   */
  toJSON(): string {
    return `.${this.value}`;
  }
}

/**
 * Represents a Zig character literal (e.g., `'a'` or `'\n'`).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/#Character-Literals}
 */
export class CharLiteral {
  /**
   * The value of the character literal (without the quotes).
   * @readonly
   */
  public readonly value: string;

  /**
   * Creates a new CharLiteral instance.
   * @param value A string containing exactly one Unicode scalar value.
   * @throws {TypeError} If `value` does not contain exactly one Unicode scalar value or is a surrogate code point.
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
   * @returns The formatted character literal string.
   */
  toString(): string {
    return `'${this.value}'`;
  }

  /**
   * Returns the serialized JSON string representation.
   * @returns The character value.
   */
  toJSON(): string {
    return this.value;
  }
}

/** Options for parsing ZON. */
export interface ParseOptions {
  /**
   * How to represent enum literals.
   * - `'class'` (default): returns an instance of {@link EnumLiteral}
   * - `'string'`: returns a string without the dot (e.g., `'docent'`)
   * - `'prefix'`: returns a string prefixed with a dot (e.g., `'.docent'`)
   *
   * @default "class"
   */
  enumLiteral?: "class" | "string" | "prefix";

  /**
   * How to represent character literals.
   * - `'class'` (default): returns an instance of {@link CharLiteral}
   * - `'string'`: returns a string of length 1 (e.g., `'a'`)
   * - `'number'`: returns the Unicode code point integer (e.g., `97`)
   *
   * @default "class"
   */
  charLiteral?: "class" | "string" | "number";

  /**
   * How to represent integers that exceed safe limits (`Number.MAX_SAFE_INTEGER`).
   * - `'bigint'` (default): returns a BigInt
   * - `'number'`: returns a number (may lose precision)
   * - `'string'`: returns the string representation
   *
   * @default "bigint"
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
   *
   * @default ""
   */
  space?: string | number;

  /**
   * A function that transforms the results.
   *
   * @param this The parent object containing the property.
   * @param key The property key or array index being stringified.
   * @param value The value being stringified.
   * @returns The transformed value, or `undefined` to omit the property.
   */
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
}

/**
 * Represents the manifest file for a Zig project (`build.zig.zon`).
 *
 * @see {@link https://codeberg.org/ziglang/zig/src/tag/0.16.0/doc/build.zig.zon.md}
 */
export interface Manifest {
  /**
   * The default package name used by dependents.
   * Must be a valid bare Zig identifier (without `@""`), limited to 32 bytes.
   */
  name: string | EnumLiteral;

  /**
   * Semver version of the package, limited to 32 bytes.
   */
  version: string;

  /**
   * A 64-bit integer combining a 32-bit ID component and a 32-bit checksum.
   * Together with `name`, represents a globally unique package identifier.
   */
  fingerprint: number | bigint;

  /**
   * Optional advisory minimum Zig compiler semver version required.
   */
  minimum_zig_version?: string;

  /**
   * Map of package dependencies declared by this manifest.
   */
  dependencies: Record<string, Dependency>;

  /**
   * Set of files and directories relative to the build root included in this package.
   * Only these included files are used to compute the package multihash.
   */
  paths: string[];
}

/**
 * Environment variables inspected by the Zig compiler and printed by `zig env`.
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zig.EnvVar}
 */
export type EnvVar =
  | "ZIG_GLOBAL_CACHE_DIR"
  | "ZIG_LOCAL_CACHE_DIR"
  | "ZIG_LIB_DIR"
  | "ZIG_LIBC"
  | "ZIG_BUILD_RUNNER"
  | "ZIG_BUILD_ERROR_STYLE"
  | "ZIG_BUILD_MULTILINE_ERRORS"
  | "ZIG_VERBOSE_LINK"
  | "ZIG_VERBOSE_CC"
  | "ZIG_DEBUG_CMD"
  | "ZIG_IS_DETECTING_LIBC_PATHS"
  | "ZIG_IS_TRYING_TO_NOT_CALL_ITSELF"
  | "NIX_CFLAGS_COMPILE"
  | "NIX_CFLAGS_LINK"
  | "NIX_LDFLAGS"
  | "C_INCLUDE_PATH"
  | "CPLUS_INCLUDE_PATH"
  | "LIBRARY_PATH"
  | "CC"
  | "NO_COLOR"
  | "CLICOLOR_FORCE"
  | "XDG_CACHE_HOME"
  | "LOCALAPPDATA"
  | "HOME"
  | "PROGRAMDATA"
  | "HOMEBREW_PREFIX";

/**
 * Represents the environment output by the Zig compiler when invoked with `zig env`.
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zig.EnvVar}
 */
export interface Environment {
  /** Absolute path to the Zig compiler executable. */
  zig_exe: string;
  /** Absolute path to the Zig compiler library directory. */
  lib_dir: string;
  /** Absolute path to the Zig standard library root directory. */
  std_dir: string;
  /** Absolute path to the global package cache directory. */
  global_cache_dir: string;
  /** The Zig compiler version string. */
  version: string;
  /** Target triple string for the host machine. */
  target: string;
  /** Map of environment variables and cache locations reported by `zig env`. */
  env: Record<EnvVar | (string & Record<never, never>), string | null>;
}

/**
 * Represents a dependency in a Zig package manifest (`build.zig.zon`).
 * Either a local {@link PathDependency} or a remote {@link PackageDependency}.
 */
export type Dependency = PathDependency | PackageDependency;

/**
 * A local path-based dependency in `build.zig.zon`.
 */
export interface PathDependency {
  /** Filesystem path to the dependency relative to the build root. */
  path: string;
  /** When true, the dependency is lazily fetched only when actually used. */
  lazy?: boolean;
  /** Not defined for path-based dependencies. */
  url?: never;
  /** Not defined for path-based dependencies. */
  hash?: never;
}

/**
 * A remote URL and cryptographic hash package dependency in `build.zig.zon`.
 */
export interface PackageDependency {
  /** URL mirror to fetch the dependency tarball or repository. */
  url: string;
  /** Cryptographic multihash of the package directory tree (the source of truth). */
  hash: string;
  /** When true, the dependency is lazily fetched only when actually used. */
  lazy?: boolean;
  /** Not defined for package-based dependencies. */
  path?: never;
}
