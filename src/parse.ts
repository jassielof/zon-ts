/**
 * Parser for Zig Object Notation (ZON).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zon|Zig's ZON module}
 *
 * @module
 */

import {
  type RawComment,
  type Token,
  Tokenizer,
  TokenType,
} from "./tokenizer.ts";
import { CharLiteral, EnumLiteral, HexLiteral } from "./types.ts";
import type {
  Comment,
  CommentTable,
  ParseOptions,
  ParseResult,
  PreserveCommentsOptions,
} from "./types.ts";

function unescapeString(raw: string): string {
  let content = "";
  if (raw.startsWith('@"')) {
    content = raw.slice(2, -1);
  } else if (raw.startsWith('"') && raw.endsWith('"')) {
    content = raw.slice(1, -1);
  } else if (raw.startsWith("'") && raw.endsWith("'")) {
    content = raw.slice(1, -1);
  } else {
    return raw;
  }

  let result = "";
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === "\\") {
      i++;
      if (i >= content.length) {
        throw new Error("Invalid escape sequence: trailing backslash");
      }
      const esc = content[i];
      switch (esc) {
        case "n":
          result += "\n";
          break;
        case "r":
          result += "\r";
          break;
        case "t":
          result += "\t";
          break;
        case "\\":
          result += "\\";
          break;
        case "'":
          result += "'";
          break;
        case '"':
          result += '"';
          break;
        case "x": {
          if (i + 2 >= content.length) {
            throw new Error("Invalid hex escape sequence");
          }
          const hex = content.substring(i + 1, i + 3);
          if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
            throw new Error(`Invalid hex escape sequence: \\x${hex}`);
          }
          result += String.fromCharCode(parseInt(hex, 16));
          i += 2;
          break;
        }
        case "u": {
          if (content[i + 1] !== "{") {
            throw new Error("Invalid unicode escape sequence, expected '{'");
          }
          const endBrace = content.indexOf("}", i + 2);
          if (endBrace === -1) {
            throw new Error("Invalid unicode escape sequence, missing '}'");
          }
          const hex = content.substring(i + 2, endBrace);
          if (
            hex.length === 0 || hex.length > 6 || !/^[0-9a-fA-F]+$/.test(hex)
          ) {
            throw new Error(`Invalid unicode escape sequence: \\u{${hex}}`);
          }
          const codePoint = parseInt(hex, 16);
          if (
            codePoint > 0x10ffff ||
            (codePoint >= 0xd800 && codePoint <= 0xdfff)
          ) {
            throw new Error(`Unicode code point out of range: \\u{${hex}}`);
          }
          result += String.fromCodePoint(codePoint);
          i = endBrace;
          break;
        }
        default:
          throw new Error(`Invalid escape sequence: \\${esc}`);
      }
    } else {
      result += c;
    }
  }
  return result;
}

function parseHexFloat(str: string): number {
  const parts = str.toLowerCase().split("p");
  const significand = parts[0];
  const exponentStr = parts[1] || "0";
  const exponent = parseInt(exponentStr, 10);

  const sigParts = significand.split(".");
  const intPartHex = sigParts[0].substring(2); // strip 0x
  const fracPartHex = sigParts[1] || "";

  let val = intPartHex ? parseInt(intPartHex, 16) : 0;

  if (fracPartHex) {
    for (let i = 0; i < fracPartHex.length; i++) {
      val += parseInt(fracPartHex[i], 16) * Math.pow(16, -(i + 1));
    }
  }

  return val * Math.pow(2, exponent);
}

function parseZigNumber(
  str: string,
  bigintOption: "bigint" | "number" | "string",
  hexLiteralOption?: "class" | "bigint" | "string",
): number | bigint | string | HexLiteral {
  const clean = str.replace(/_/g, "");

  const isHex = clean.toLowerCase().startsWith("0x");
  const isFloat = isHex
    ? (clean.includes(".") || clean.toLowerCase().includes("p"))
    : (clean.includes(".") || clean.toLowerCase().includes("e"));

  if (isFloat) {
    if (clean.toLowerCase().startsWith("0x")) {
      return parseHexFloat(clean);
    }
    return parseFloat(clean);
  }

  if (isHex && hexLiteralOption === "class") {
    return new HexLiteral(clean);
  }

  if (isHex && hexLiteralOption === "string") {
    return clean;
  }

  let val: bigint;
  try {
    val = BigInt(clean);
  } catch {
    // Fallback if BigInt fails for some reason (e.g. hex float parsed as int by mistake)
    return parseFloat(clean);
  }

  if (bigintOption === "string") {
    return val.toString();
  }
  if (bigintOption === "number") {
    return Number(val);
  }

  if (
    val >= BigInt(Number.MIN_SAFE_INTEGER) &&
    val <= BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return Number(val);
  }
  return val;
}

class Parser {
  private tokenizer: Tokenizer;
  private currentToken!: Token;
  private peekToken!: Token;
  private options: ParseOptions;
  private commentTable: CommentTable = {
    fileDoc: [],
    nodes: new Map(),
  };

  constructor(input: string, options: ParseOptions = {}) {
    this.tokenizer = new Tokenizer(input, options.preserveComments);
    this.options = options;
    this.advance();
    this.advance();
  }

  public getCurrentTokenType(): TokenType {
    return this.currentToken.type;
  }

  public getCurrentTokenLine(): number {
    return this.currentToken.line;
  }

  private advance(): void {
    this.currentToken = this.peekToken;
    this.peekToken = this.tokenizer.next();
  }

  private consume(type: TokenType): Token {
    if (this.currentToken.type !== type) {
      throw new Error(
        `Expected token ${type} but found ${this.currentToken.type} (${
          JSON.stringify(this.currentToken.value)
        }) at line ${this.currentToken.line}, col ${this.currentToken.col}`,
      );
    }
    const tok = this.currentToken;
    this.advance();
    return tok;
  }

  private attachComments(
    path: string,
    type: "leading" | "inner",
    comments: RawComment[],
  ): void {
    if (!this.options.preserveComments) return;
    const nonFile: Comment[] = [];
    for (const c of comments) {
      if (c.kind === "file") {
        this.commentTable.fileDoc.push(c.text);
      } else {
        nonFile.push({ kind: c.kind, text: c.text });
      }
    }
    if (nonFile.length === 0) return;

    const existing = this.commentTable.nodes.get(path) ?? {};
    if (type === "leading") {
      existing.leading = [...(existing.leading ?? []), ...nonFile];
    } else {
      existing.inner = [...(existing.inner ?? []), ...nonFile];
    }
    this.commentTable.nodes.set(path, existing);
  }

  private attachTrailingComment(path: string, comment: RawComment): void {
    if (!this.options.preserveComments) return;
    if (comment.kind === "file") {
      this.commentTable.fileDoc.push(comment.text);
      return;
    }
    const existing = this.commentTable.nodes.get(path) ?? {};
    existing.trailing = { kind: comment.kind, text: comment.text };
    this.commentTable.nodes.set(path, existing);
  }

  public finalizeComments(): void {
    if (!this.options.preserveComments) return;
    if (this.currentToken.trailingComment) {
      this.attachTrailingComment("", this.currentToken.trailingComment);
    }
    if (this.currentToken.leadingComments) {
      for (const c of this.currentToken.leadingComments) {
        if (c.kind === "file") {
          this.commentTable.fileDoc.push(c.text);
        } else {
          const existing = this.commentTable.nodes.get("") ?? {};
          existing.inner = [
            ...(existing.inner ?? []),
            { kind: c.kind, text: c.text },
          ];
          this.commentTable.nodes.set("", existing);
        }
      }
    }
  }

  public getCommentTable(): CommentTable {
    return this.commentTable;
  }

  private parseStructLiteral(currentPath: string = ""): unknown {
    this.consume(TokenType.LBrace);

    if (this.currentToken.type === TokenType.RBrace) {
      if (this.currentToken.leadingComments) {
        this.attachComments(
          currentPath,
          "inner",
          this.currentToken.leadingComments,
        );
      }
      this.consume(TokenType.RBrace);
      return []; // Return empty array by default for .{}
    }

    let result: Record<string, unknown> | unknown[] | undefined = undefined;
    let isArray = false;
    let lastChildPath: string | undefined = undefined;

    while (
      (this.currentToken.type as TokenType) !== TokenType.RBrace &&
      this.currentToken.type !== TokenType.Eof
    ) {
      if (lastChildPath !== undefined && this.currentToken.trailingComment) {
        this.attachTrailingComment(
          lastChildPath,
          this.currentToken.trailingComment,
        );
      }

      if (
        this.currentToken.type === TokenType.Period &&
        this.peekToken.type !== TokenType.LBrace
      ) {
        if (result === undefined) {
          result = {};
          isArray = false;
        } else if (isArray) {
          throw new Error(
            `Expected array element but found object field starting with '.' at line ${this.currentToken.line}, col ${this.currentToken.col}`,
          );
        }

        const periodTok = this.currentToken;
        this.consume(TokenType.Period);
        const fieldToken = this.consume(TokenType.Identifier);
        const fieldName = unescapeString(fieldToken.value);
        const childPath = currentPath
          ? `${currentPath}.${fieldName}`
          : `.${fieldName}`;
        lastChildPath = childPath;

        if (periodTok.leadingComments) {
          this.attachComments(childPath, "leading", periodTok.leadingComments);
        }
        if (fieldToken.leadingComments) {
          this.attachComments(childPath, "leading", fieldToken.leadingComments);
        }

        this.consume(TokenType.Equal);
        if (this.currentToken.leadingComments) {
          this.attachComments(
            childPath,
            "leading",
            this.currentToken.leadingComments,
          );
        }
        const val = this.parseValue(childPath);
        if (Object.hasOwn(result as Record<string, unknown>, fieldName)) {
          throw new Error(
            `Duplicate field '${fieldName}' at line ${fieldToken.line}, col ${fieldToken.col}`,
          );
        }
        // defineProperty keeps special names such as `__proto__` as ordinary
        // ZON fields instead of mutating the parsed object's prototype.
        Object.defineProperty(result as Record<string, unknown>, fieldName, {
          value: val,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      } else {
        if (result === undefined) {
          result = [];
          isArray = true;
        } else if (!isArray) {
          throw new Error(
            `Expected object field (starting with '.') but found array element at line ${this.currentToken.line}, col ${this.currentToken.col}`,
          );
        }

        const elemIndex = (result as unknown[]).length;
        const childPath = `${currentPath}[${elemIndex}]`;
        lastChildPath = childPath;

        if (this.currentToken.leadingComments) {
          this.attachComments(
            childPath,
            "leading",
            this.currentToken.leadingComments,
          );
        }

        const val = this.parseValue(childPath);
        (result as unknown[]).push(val);
      }

      if (this.currentToken.type === TokenType.Comma) {
        this.consume(TokenType.Comma);
      } else if ((this.currentToken.type as TokenType) !== TokenType.RBrace) {
        throw new Error(
          `Expected ',' or '}' after value at line ${this.currentToken.line}, col ${this.currentToken.col}`,
        );
      }
    }

    if (lastChildPath !== undefined && this.currentToken.trailingComment) {
      this.attachTrailingComment(
        lastChildPath,
        this.currentToken.trailingComment,
      );
    }
    if (this.currentToken.leadingComments) {
      this.attachComments(
        currentPath,
        "inner",
        this.currentToken.leadingComments,
      );
    }

    this.consume(TokenType.RBrace);
    return result;
  }

  public parseValue(currentPath: string = ""): unknown {
    const tok = this.currentToken;

    if (currentPath === "" && tok.leadingComments) {
      this.attachComments("", "leading", tok.leadingComments);
    }

    switch (tok.type) {
      case TokenType.Period: {
        if (this.peekToken.type === TokenType.LBrace) {
          this.consume(TokenType.Period);
          return this.parseStructLiteral(currentPath);
        } else if (this.peekToken.type === TokenType.Identifier) {
          this.consume(TokenType.Period);
          const identTok = this.consume(TokenType.Identifier);
          const val = unescapeString(identTok.value);

          if (this.options.enumLiteral === "string") {
            return val;
          } else if (this.options.enumLiteral === "prefix") {
            return `.${val}`;
          } else {
            return new EnumLiteral(val);
          }
        } else {
          throw new Error(
            `Unexpected token after '.' at line ${tok.line}, col ${tok.col}`,
          );
        }
      }

      case TokenType.StringLiteral: {
        const val = unescapeString(tok.value);
        this.advance();
        return val;
      }

      case TokenType.MultilineString: {
        let val = "";
        let first = true;
        while (this.currentToken.type === TokenType.MultilineString) {
          const rawLine = this.currentToken.value;
          const content = rawLine.substring(2);
          if (!first) {
            val += "\n";
          }
          val += content;
          first = false;
          this.advance();
        }
        return val;
      }

      case TokenType.CharLiteral: {
        const val = unescapeString(tok.value);
        this.advance();

        if (Array.from(val).length !== 1) {
          throw new Error(
            `Character literal must contain exactly one Unicode code point at line ${tok.line}, col ${tok.col}`,
          );
        }

        if (this.options.charLiteral === "string") {
          return val;
        } else if (this.options.charLiteral === "number") {
          return val.codePointAt(0);
        } else {
          return new CharLiteral(val);
        }
      }

      case TokenType.NumberLiteral: {
        const val = tok.value;
        this.advance();
        return parseZigNumber(
          val,
          this.options.bigint ?? "bigint",
          this.options.hexLiteral,
        );
      }

      case TokenType.Minus: {
        this.consume(TokenType.Minus);
        const nextTok = this.currentToken;
        if (nextTok.type === TokenType.NumberLiteral) {
          this.advance();
          const parsed = parseZigNumber(
            nextTok.value,
            this.options.bigint ?? "bigint",
            this.options.hexLiteral,
          );
          if (parsed instanceof HexLiteral) {
            return new HexLiteral(-parsed.value);
          } else if (typeof parsed === "bigint") {
            return -parsed;
          } else if (typeof parsed === "number") {
            return -parsed;
          } else {
            return "-" + parsed;
          }
        }
        if (nextTok.type === TokenType.Identifier && nextTok.value === "inf") {
          this.advance();
          return -Infinity;
        }
        throw new Error(
          `Expected number literal or 'inf' after '-' at line ${tok.line}, col ${tok.col}`,
        );
      }

      case TokenType.Plus: {
        this.consume(TokenType.Plus);
        const nextTok = this.currentToken;
        if (nextTok.type === TokenType.NumberLiteral) {
          this.advance();
          return parseZigNumber(
            nextTok.value,
            this.options.bigint ?? "bigint",
            this.options.hexLiteral,
          );
        }
        if (nextTok.type === TokenType.Identifier && nextTok.value === "inf") {
          this.advance();
          return Infinity;
        }
        throw new Error(
          `Expected number literal or 'inf' after '+' at line ${tok.line}, col ${tok.col}`,
        );
      }

      case TokenType.Identifier: {
        const val = tok.value;
        if (val === "true") {
          this.advance();
          return true;
        }
        if (val === "false") {
          this.advance();
          return false;
        }
        if (val === "null") {
          this.advance();
          return null;
        }
        if (val === "nan") {
          this.advance();
          return NaN;
        }
        if (val === "inf") {
          this.advance();
          return Infinity;
        }
        throw new Error(
          `Unexpected identifier '${val}' at line ${tok.line}, col ${tok.col}`,
        );
      }

      default:
        throw new Error(
          `Unexpected token '${tok.value}' (${tok.type}) at line ${tok.line}, col ${tok.col}`,
        );
    }
  }
}

/**
 * Parses a Zig Object Notation (ZON) string into a value, preserving comments into a {@link CommentTable}.
 *
 * @template T The expected type of the parsed value.
 * @param input The ZON string to parse.
 * @param options Parsing options with `preserveComments` enabled.
 * @returns A {@link ParseResult} containing the parsed value and preserved comments.
 */
export function parse<T = unknown>(
  input: string,
  options: ParseOptions & { preserveComments: true | PreserveCommentsOptions },
): ParseResult<T>;
/**
 * Parses a Zig Object Notation (ZON) string into a value.
 *
 * @template T The expected type of the parsed value.
 * @param input The ZON string to parse.
 * @param options Parsing configuration options.
 * @returns The parsed value as type `T`.
 */
export function parse<T = unknown>(
  input: string,
  options?: ParseOptions & { preserveComments?: false },
): T;
/**
 * Parses a Zig Object Notation (ZON) string into a value or a {@link ParseResult}.
 *
 * @template T The expected type of the parsed value.
 * @param input The ZON string to parse.
 * @param options Parsing configuration options.
 * @returns The parsed value as type `T`, or a {@link ParseResult} if `preserveComments` is enabled.
 * @throws {Error} If the ZON input contains invalid syntax, unexpected tokens, or duplicate struct fields.
 *
 * @example Parsing a struct into an object
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse } from "./parse.ts";
 * import { EnumLiteral } from "./types.ts";
 *
 * const result = parse(".{ .name = .docent, .version = \"1.0.0\" }");
 * assertEquals(result, { name: new EnumLiteral("docent"), version: "1.0.0" });
 * ```
 *
 * @example Parsing with comment preservation
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse } from "./parse.ts";
 *
 * const zon = `//! File header doc
 * .{
 *     // Field comment
 *     .name = "zon",
 * }`;
 * const result = parse(zon, { preserveComments: true });
 * assertEquals(result.value, { name: "zon" });
 * assertEquals(result.comments.fileDoc, [" File header doc"]);
 * assertEquals(result.comments.nodes.get(".name")?.leading?.[0]?.text, " Field comment");
 * ```
 *
 * @example Parsing a tuple/array
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse } from "./parse.ts";
 *
 * const array = parse(".{ 1, 2, 3 }");
 * assertEquals(array, [1, 2, 3]);
 * ```
 *
 * @example Using custom parse options for enums and characters
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse } from "./parse.ts";
 *
 * const zon = ".{ .target = .x86_64, .delim = '/' }";
 * const parsed = parse(zon, { enumLiteral: "string", charLiteral: "string" });
 * assertEquals(parsed, { target: "x86_64", delim: "/" });
 * ```
 *
 * @example Type-safe parsing with a generic type parameter
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse } from "./parse.ts";
 *
 * interface PackageInfo {
 *   name: string;
 *   version: string;
 *   paths: string[];
 * }
 *
 * const zon = `.{
 *   .name = "my_pkg",
 *   .version = "0.1.0",
 *   .paths = .{ "src", "README.md" },
 * }`;
 *
 * const pkg = parse<PackageInfo>(zon);
 * assertEquals(pkg.name, "my_pkg");
 * assertEquals(pkg.paths, ["src", "README.md"]);
 * ```
 */
export function parse<T = unknown>(
  input: string,
  options?: ParseOptions,
): T | ParseResult<T> {
  const parser = new Parser(input, options);
  const result = parser.parseValue("");
  if (parser.getCurrentTokenType() !== TokenType.Eof) {
    throw new Error(
      `Unexpected tokens after expression at line ${parser.getCurrentTokenLine()}`,
    );
  }
  if (options?.preserveComments) {
    parser.finalizeComments();
    return {
      value: result as T,
      comments: parser.getCommentTable(),
    };
  }
  return result as T;
}
