import { type Token, Tokenizer, TokenType } from "./tokenizer.ts";
import { CharLiteral, EnumLiteral, type ParseOptions } from "./types.ts";

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
          if (codePoint > 0x10ffff) {
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
): number | bigint | string {
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

  constructor(input: string, options: ParseOptions = {}) {
    this.tokenizer = new Tokenizer(input);
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

  private parseStructLiteral(): unknown {
    this.consume(TokenType.LBrace);

    if (this.currentToken.type === TokenType.RBrace) {
      this.consume(TokenType.RBrace);
      return []; // Return empty array by default for .{}
    }

    let result: Record<string, unknown> | unknown[] | undefined = undefined;
    let isArray = false;

    while (
      (this.currentToken.type as TokenType) !== TokenType.RBrace &&
      this.currentToken.type !== TokenType.Eof
    ) {
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

        this.consume(TokenType.Period);
        const fieldToken = this.consume(TokenType.Identifier);
        const fieldName = unescapeString(fieldToken.value);

        this.consume(TokenType.Equal);
        const val = this.parseValue();
        (result as Record<string, unknown>)[fieldName] = val;
      } else {
        if (result === undefined) {
          result = [];
          isArray = true;
        } else if (!isArray) {
          throw new Error(
            `Expected object field (starting with '.') but found array element at line ${this.currentToken.line}, col ${this.currentToken.col}`,
          );
        }

        const val = this.parseValue();
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

    this.consume(TokenType.RBrace);
    return result;
  }

  public parseValue(): unknown {
    const tok = this.currentToken;

    switch (tok.type) {
      case TokenType.Period: {
        if (this.peekToken.type === TokenType.LBrace) {
          this.consume(TokenType.Period);
          return this.parseStructLiteral();
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

        if (this.options.charLiteral === "string") {
          return val;
        } else if (this.options.charLiteral === "number") {
          return val.charCodeAt(0);
        } else {
          return new CharLiteral(val);
        }
      }

      case TokenType.NumberLiteral: {
        const val = tok.value;
        this.advance();
        return parseZigNumber(val, this.options.bigint ?? "bigint");
      }

      case TokenType.Minus: {
        this.consume(TokenType.Minus);
        const nextTok = this.currentToken;
        if (nextTok.type === TokenType.NumberLiteral) {
          this.advance();
          const parsed = parseZigNumber(
            nextTok.value,
            this.options.bigint ?? "bigint",
          );
          if (typeof parsed === "bigint") {
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
          return parseZigNumber(nextTok.value, this.options.bigint ?? "bigint");
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

export function parse<T = unknown>(input: string, options?: ParseOptions): T {
  const parser = new Parser(input, options);
  const result = parser.parseValue();
  if (parser.getCurrentTokenType() !== TokenType.Eof) {
    throw new Error(
      `Unexpected tokens after expression at line ${parser.getCurrentTokenLine()}`,
    );
  }
  return result as unknown as T;
}
