/**
 * A library for de/serializing Zig Object Notation (ZON).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zon|Zig's ZON module} for more information.
 *
 * @example Basic Usage
 *
 * ```ts
 * import { parse, stringify } from "@jassiel/zon";
 *
 * const doc = parse(".{ .name = \"example\", .version = \"1.0.0\" }");
 * const text = stringify(doc, { space: 4 });
 * ```
 *
 * @module
 */

export { parse } from "./parse.ts";
export { stringify } from "./stringify.ts";
export { type Token, Tokenizer, TokenType } from "./tokenizer.ts";
export {
  CharLiteral,
  type Dependency,
  EnumLiteral,
  type Environment,
  type EnvVar,
  type Manifest,
  type PackageDependency,
  type ParseOptions,
  type PathDependency,
  type StringifyOptions,
  type ZonValue,
} from "./types.ts";
