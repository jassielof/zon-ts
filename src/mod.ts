/**
 * A TypeScript library for de/serializing Zig Object Notation (ZON).
 *
 * @example
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
  type Manifest,
  type PackageDependency,
  type ParseOptions,
  type PathDependency,
  type StringifyOptions,
  type ZonValue,
} from "./types.ts";
