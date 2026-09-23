/**
 * A library for de/serializing Zig Object Notation (ZON).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zon|Zig's ZON module} for more information.
 *
 * @example Parsing and stringifying a Zig package manifest
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { EnumLiteral, HexLiteral, type Manifest, parse, stringify } from "@jassiel/zon";
 *
 * const manifest = `
 * //! Package manifest for docent
 * .{
 *     /// Package name identifier
 *     .name = .docent,
 *     .version = "0.0.0",
 *     // Package fingerprint (64-bit hexadecimal integer)
 *     .fingerprint = 0xf25cae59b814c9e6,
 *     .dependencies = .{
 *         .fangz = .{ .path = "dependencies/fangz" },
 *         .carnaval = .{ .path = "dependencies/fangz/dependencies/carnaval" },
 *         .toml = .{ .path = "dependencies/toml" },
 *         .dmp = .{ .path = "dependencies/dmp" },
 *     },
 *     .minimum_zig_version = "0.16.0",
 *     .paths = .{
 *         "build.zig",
 *         "build.zig.zon",
 *         ".config",
 *         "cmd",
 *         "lib",
 *         "internal",
 *         "dependencies",
 *         "LICENSE.txt",
 *         "README.md",
 *     },
 * }
 * `;
 *
 * const doc = parse<Manifest>(manifest, { hexLiteral: "class" });
 * assertEquals(doc.name, new EnumLiteral("docent"));
 * assertEquals(doc.fingerprint, new HexLiteral("0xf25cae59b814c9e6"));
 *
 * const text = stringify(doc, { space: 4 });
 * const roundtrip = parse<Manifest>(text, { hexLiteral: "class" });
 * assertEquals(roundtrip, doc);
 * ```
 *
 * @example Parsing character literals and enums
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { CharLiteral, EnumLiteral, parse, stringify } from "@jassiel/zon";
 *
 * const data = parse(".{ .mode = .release, .symbol = 'Z' }");
 * assertEquals(data, { mode: new EnumLiteral("release"), symbol: new CharLiteral("Z") });
 * assertEquals(stringify(data), ".{.mode=.release,.symbol='Z'}");
 * ```
 *
 * @example Preserving comments across parse and stringify
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse, stringify } from "@jassiel/zon";
 *
 * const source = `//! Package manifest
 * .{
 *     // Project name
 *     .name = "zon",
 * }`;
 * const result = parse(source, { preserveComments: true });
 * const output = stringify(result, { space: 4 });
 * assertEquals(output, source);
 * ```
 *
 * @module
 */

export { parse } from "./parse.ts";
export { stringify } from "./stringify.ts";
export { type Token, Tokenizer, TokenType } from "./tokenizer.ts";
export {
  CharLiteral,
  type Comment,
  type CommentTable,
  type Dependency,
  EnumLiteral,
  type Environment,
  type EnvVar,
  HexLiteral,
  type Manifest,
  type NodeComments,
  type PackageDependency,
  type ParseOptions,
  type ParseResult,
  type PathDependency,
  type PreserveCommentsOptions,
  type StringifyOptions,
  type ZonValue,
} from "./types.ts";
