import { CharLiteral, EnumLiteral, type StringifyOptions } from "./types.ts";

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
      if (c === "\\" || c === '"') {
        escaped += "\\" + c;
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

  function run(
    val: unknown,
    currentIndent: string,
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

    if (typeof val === "string") {
      return escapeString(val);
    }

    if (Array.isArray(val)) {
      if (val.length === 0) {
        return ".{}";
      }
      const nextIndent = isPretty ? currentIndent + indentStr : "";
      const items = val.map((item, i) => {
        let currentItem = item;
        if (
          currentItem &&
          typeof (currentItem as { toJSON?: () => unknown }).toJSON ===
            "function" &&
          !(currentItem instanceof EnumLiteral) &&
          !(currentItem instanceof CharLiteral)
        ) {
          currentItem = (currentItem as { toJSON: () => unknown }).toJSON();
        }
        let replaced = currentItem;
        if (replacer) {
          replaced = replacer.call(val, String(i), currentItem);
        }
        return run(replaced, nextIndent);
      });
      if (isPretty) {
        return `.{\n` + nextIndent + items.join(",\n" + nextIndent) + `,\n` +
          currentIndent + `}`;
      } else {
        return `.{` + items.join(",") + `}`;
      }
    }

    if (typeof val === "object") {
      const entries: [string, unknown][] = [];
      for (const [k, v] of Object.entries(val)) {
        let currentV = v;
        if (
          currentV &&
          typeof (currentV as { toJSON?: () => unknown }).toJSON ===
            "function" &&
          !(currentV instanceof EnumLiteral) &&
          !(currentV instanceof CharLiteral)
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
        return ".{}";
      }

      const nextIndent = isPretty ? currentIndent + indentStr : "";
      const items = entries.map(([k, v]) => {
        const itemVal = run(v, nextIndent);
        const itemKey = formatKey(k);
        const eq = isPretty ? " = " : "=";
        return `.${itemKey}${eq}${itemVal}`;
      });

      if (isPretty) {
        return `.{\n` + nextIndent + items.join(",\n" + nextIndent) + `,\n` +
          currentIndent + `}`;
      } else {
        return `.{` + items.join(",") + `}`;
      }
    }

    return String(val);
  }

  let rootValue = value;
  if (
    rootValue &&
    typeof (rootValue as { toJSON?: () => unknown }).toJSON === "function" &&
    !(rootValue instanceof EnumLiteral) &&
    !(rootValue instanceof CharLiteral)
  ) {
    rootValue = (rootValue as { toJSON: () => unknown }).toJSON();
  }
  if (replacer) {
    rootValue = replacer.call({ "": value }, "", rootValue);
  }
  return run(rootValue, "");
}
