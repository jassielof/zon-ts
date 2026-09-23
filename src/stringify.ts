/**
 * Serializer for Zig Object Notation (ZON).
 *
 * @see {@link https://ziglang.org/documentation/0.16.0/std/#std.zon|Zig's ZON module}
 *
 * @module
 */

import { CharLiteral, EnumLiteral, HexLiteral } from "./types.ts";
import type { Comment, ParseResult, StringifyOptions } from "./types.ts";

const ZIG_KEYWORDS = new Set([
  "addrspace",
  "align",
  "allowzero",
  "and",
  "anyframe",
  "anytype",
  "asm",
  "async",
  "await",
  "break",
  "callconv",
  "catch",
  "comptime",
  "const",
  "continue",
  "defer",
  "else",
  "enum",
  "errdefer",
  "error",
  "export",
  "extern",
  "fn",
  "for",
  "if",
  "inline",
  "noalias",
  "noinline",
  "nosuspend",
  "opaque",
  "or",
  "orelse",
  "packed",
  "pub",
  "resume",
  "return",
  "linksection",
  "struct",
  "suspend",
  "switch",
  "test",
  "threadlocal",
  "try",
  "union",
  "unreachable",
  "usingnamespace",
  "var",
  "volatile",
  "while",
]);

function formatKey(key: string): string {
  const isKeyword = ZIG_KEYWORDS.has(key);
  const isValidIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);

  if (isKeyword || !isValidIdent) {
    let escaped = "";
    for (let i = 0; i < key.length; i++) {
      const c = key[i];
      const code = key.charCodeAt(i);
      if (c === "\\" || c === '"') {
        escaped += "\\" + c;
      } else if (code < 0x20 || code === 0x7f) {
        escaped += "\\x" + code.toString(16).padStart(2, "0");
      } else {
        escaped += c;
      }
    }
    return `@"${escaped}"`;
  }
  return key;
}

function escapeString(str: string): string {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);
    switch (char) {
      case "\n":
        result += "\\n";
        break;
      case "\r":
        result += "\\r";
        break;
      case "\t":
        result += "\\t";
        break;
      case "\\":
        result += "\\\\";
        break;
      case '"':
        result += '\\"';
        break;
      default:
        if (code < 0x20 || code === 0x7f) {
          result += "\\x" + code.toString(16).padStart(2, "0");
        } else {
          result += char;
        }
    }
  }
  result += '"';
  return result;
}

function escapeChar(char: string): string {
  let result = "'";
  const code = char.charCodeAt(0);
  switch (char) {
    case "\n":
      result += "\\n";
      break;
    case "\r":
      result += "\\r";
      break;
    case "\t":
      result += "\\t";
      break;
    case "\\":
      result += "\\\\";
      break;
    case "'":
      result += "\\'";
      break;
    default:
      if (code < 0x20 || code === 0x7f) {
        result += "\\x" + code.toString(16).padStart(2, "0");
      } else {
        result += char;
      }
  }
  result += "'";
  return result;
}

/**
 * Serializes a value into a Zig Object Notation (ZON) string.
 *
 * @param value The value to serialize into ZON.
 * @param options Stringification options.
 * @returns The ZON string representation.
 *
 * @example Basic compact serialization
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { stringify } from "./stringify.ts";
 * import { EnumLiteral } from "./types.ts";
 *
 * const zon = stringify({ name: new EnumLiteral("docent"), version: "1.0.0" });
 * assertEquals(zon, ".{.name=.docent,.version=\"1.0.0\"}");
 * ```
 *
 * @example Formatted output with indentation
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { stringify } from "./stringify.ts";
 *
 * const data = {
 *   name: "example",
 *   paths: ["src", "build.zig"],
 * };
 * const zon = stringify(data, { space: 4 });
 * assertEquals(zon, `.{
 *     .name = "example",
 *     .paths = .{
 *         "src",
 *         "build.zig",
 *     },
 * }`);
 * ```
 *
 * @example Escaping Zig keywords and special field names
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { stringify } from "./stringify.ts";
 *
 * const zon = stringify({ const: true, "kebab-case": 42 });
 * assertEquals(zon, `.{.@"const"=true,.@"kebab-case"=42}`);
 * ```
 *
 * @example Filtering and transforming with a replacer function
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { stringify } from "./stringify.ts";
 *
 * const data = { a: 1, b: 2, secret: "hidden" };
 * const zon = stringify(data, {
 *   replacer(key, value) {
 *     if (key === "secret") return undefined;
 *     return value;
 *   },
 * });
 * assertEquals(zon, ".{.a=1,.b=2}");
 * ```
 *
 * @example Preserving comments during stringification
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { parse } from "./parse.ts";
 * import { stringify } from "./stringify.ts";
 *
 * const zon = `//! Package manifest
 * .{
 *     // Project name
 *     .name = "zon",
 * }`;
 * const parsed = parse(zon, { preserveComments: true });
 * const formatted = stringify(parsed, { space: 4 });
 * assertEquals(formatted, zon);
 * ```
 */
export function stringify(
  value: unknown,
  options: StringifyOptions = {},
): string {
  const replacer = options.replacer;
  let indentStr = "";
  if (typeof options.space === "number") {
    indentStr = " ".repeat(options.space);
  } else if (typeof options.space === "string") {
    indentStr = options.space;
  }

  const isPretty = indentStr.length > 0;

  let rootValue = value;
  let commentsTable = options.comments;
  if (
    rootValue &&
    typeof rootValue === "object" &&
    "value" in rootValue &&
    "comments" in rootValue &&
    (rootValue as ParseResult).comments &&
    Array.isArray((rootValue as ParseResult).comments.fileDoc) &&
    (rootValue as ParseResult).comments.nodes instanceof Map
  ) {
    if (!commentsTable) {
      commentsTable = (rootValue as ParseResult).comments;
    }
    rootValue = (rootValue as ParseResult).value;
  }

  function formatCommentLine(c: Comment): string {
    const prefix = c.kind === "doc" ? "///" : "//";
    return prefix + c.text;
  }

  function run(
    val: unknown,
    currentIndent: string,
    currentPath: string = "",
  ): string {
    if (val === null || val === undefined) {
      return "null";
    }

    if (typeof val === "boolean") {
      return val ? "true" : "false";
    }

    if (typeof val === "number") {
      if (Number.isNaN(val)) return "nan";
      if (val === Infinity) return "inf";
      if (val === -Infinity) return "-inf";
      return String(val);
    }

    if (typeof val === "bigint") {
      return val.toString();
    }

    if (val instanceof EnumLiteral) {
      return `.${formatKey(val.value)}`;
    }

    if (val instanceof CharLiteral) {
      return escapeChar(val.value);
    }

    if (val instanceof HexLiteral) {
      return val.toString();
    }

    if (typeof val === "string") {
      return escapeString(val);
    }

    if (Array.isArray(val)) {
      const nodeComments = commentsTable?.nodes.get(currentPath);
      if (val.length === 0) {
        if (isPretty && nodeComments?.inner && nodeComments.inner.length > 0) {
          const nextIndent = currentIndent + indentStr;
          const innerLines = nodeComments.inner.map((c) =>
            nextIndent + formatCommentLine(c)
          );
          return `.{\n` + innerLines.join("\n") + `\n` + currentIndent + `}`;
        }
        return ".{}";
      }

      const nextIndent = isPretty ? currentIndent + indentStr : "";
      if (isPretty) {
        let out = ".{\n";
        for (let i = 0; i < val.length; i++) {
          const elemPath = `${currentPath}[${i}]`;
          const elemComments = commentsTable?.nodes.get(elemPath);

          if (elemComments?.leading && elemComments.leading.length > 0) {
            for (const lc of elemComments.leading) {
              out += nextIndent + formatCommentLine(lc) + "\n";
            }
          }

          let currentItem = val[i];
          if (
            currentItem &&
            typeof (currentItem as { toJSON?: () => unknown }).toJSON ===
              "function" &&
            !(currentItem instanceof EnumLiteral) &&
            !(currentItem instanceof CharLiteral) &&
            !(currentItem instanceof HexLiteral)
          ) {
            currentItem = (currentItem as { toJSON: () => unknown }).toJSON();
          }
          let replaced = currentItem;
          if (replacer) {
            replaced = replacer.call(val, String(i), currentItem);
          }
          const itemVal = run(replaced, nextIndent, elemPath);
          out += nextIndent + itemVal + ",";
          if (elemComments?.trailing) {
            out += " " + formatCommentLine(elemComments.trailing);
          }
          out += "\n";
        }

        if (nodeComments?.inner && nodeComments.inner.length > 0) {
          for (const ic of nodeComments.inner) {
            out += nextIndent + formatCommentLine(ic) + "\n";
          }
        }
        out += currentIndent + "}";
        return out;
      } else {
        const items = val.map((item, i) => {
          let currentItem = item;
          if (
            currentItem &&
            typeof (currentItem as { toJSON?: () => unknown }).toJSON ===
              "function" &&
            !(currentItem instanceof EnumLiteral) &&
            !(currentItem instanceof CharLiteral) &&
            !(currentItem instanceof HexLiteral)
          ) {
            currentItem = (currentItem as { toJSON: () => unknown }).toJSON();
          }
          let replaced = currentItem;
          if (replacer) {
            replaced = replacer.call(val, String(i), currentItem);
          }
          return run(replaced, nextIndent, `${currentPath}[${i}]`);
        });
        return `.{` + items.join(",") + `}`;
      }
    }

    if (typeof val === "object") {
      const nodeComments = commentsTable?.nodes.get(currentPath);
      const entries: [string, unknown][] = [];
      for (const [k, v] of Object.entries(val)) {
        let currentV = v;
        if (
          currentV &&
          typeof (currentV as { toJSON?: () => unknown }).toJSON ===
            "function" &&
          !(currentV instanceof EnumLiteral) &&
          !(currentV instanceof CharLiteral) &&
          !(currentV instanceof HexLiteral)
        ) {
          currentV = (currentV as { toJSON: () => unknown }).toJSON();
        }
        let replacedV = currentV;
        if (replacer) {
          replacedV = replacer.call(val, k, currentV);
        }
        if (replacedV !== undefined) {
          entries.push([k, replacedV]);
        }
      }

      if (entries.length === 0) {
        if (isPretty && nodeComments?.inner && nodeComments.inner.length > 0) {
          const nextIndent = currentIndent + indentStr;
          const innerLines = nodeComments.inner.map((c) =>
            nextIndent + formatCommentLine(c)
          );
          return `.{\n` + innerLines.join("\n") + `\n` + currentIndent + `}`;
        }
        return ".{}";
      }

      const nextIndent = isPretty ? currentIndent + indentStr : "";
      if (isPretty) {
        let out = ".{\n";
        for (const [k, v] of entries) {
          const fieldPath = currentPath ? `${currentPath}.${k}` : `.${k}`;
          const fieldComments = commentsTable?.nodes.get(fieldPath);

          if (fieldComments?.leading && fieldComments.leading.length > 0) {
            for (const lc of fieldComments.leading) {
              out += nextIndent + formatCommentLine(lc) + "\n";
            }
          }

          const itemVal = run(v, nextIndent, fieldPath);
          const itemKey = formatKey(k);
          out += nextIndent + `.${itemKey} = ${itemVal},`;
          if (fieldComments?.trailing) {
            out += " " + formatCommentLine(fieldComments.trailing);
          }
          out += "\n";
        }

        if (nodeComments?.inner && nodeComments.inner.length > 0) {
          for (const ic of nodeComments.inner) {
            out += nextIndent + formatCommentLine(ic) + "\n";
          }
        }
        out += currentIndent + "}";
        return out;
      } else {
        const items = entries.map(([k, v]) => {
          const fieldPath = currentPath ? `${currentPath}.${k}` : `.${k}`;
          const itemVal = run(v, nextIndent, fieldPath);
          const itemKey = formatKey(k);
          return `.${itemKey}=${itemVal}`;
        });
        return `.{` + items.join(",") + `}`;
      }
    }

    return String(val);
  }

  if (
    rootValue &&
    typeof (rootValue as { toJSON?: () => unknown }).toJSON === "function" &&
    !(rootValue instanceof EnumLiteral) &&
    !(rootValue instanceof CharLiteral) &&
    !(rootValue instanceof HexLiteral)
  ) {
    rootValue = (rootValue as { toJSON: () => unknown }).toJSON();
  }
  if (replacer) {
    rootValue = replacer.call({ "": value }, "", rootValue);
  }

  let body = run(rootValue, "", "");

  const rootComments = commentsTable?.nodes.get("");
  if (isPretty && rootComments?.trailing) {
    body += " " + formatCommentLine(rootComments.trailing);
  }

  let header = "";
  if (isPretty && commentsTable?.fileDoc && commentsTable.fileDoc.length > 0) {
    for (const doc of commentsTable.fileDoc) {
      header += `//!${doc}\n`;
    }
  }

  if (isPretty && rootComments?.leading && rootComments.leading.length > 0) {
    for (const lc of rootComments.leading) {
      header += formatCommentLine(lc) + "\n";
    }
  }

  return header + body;
}
