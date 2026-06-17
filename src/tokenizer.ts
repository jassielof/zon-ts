export enum TokenType {
  Period = "Period",
  Equal = "Equal",
  Comma = "Comma",
  LBrace = "LBrace",
  RBrace = "RBrace",
  Minus = "Minus",
  Plus = "Plus",
  Identifier = "Identifier",
  StringLiteral = "StringLiteral",
  MultilineString = "MultilineString",
  CharLiteral = "CharLiteral",
  NumberLiteral = "NumberLiteral",
  Eof = "Eof",
}

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

const NUMBER_RE =
  /^(?:0[xX][0-9a-fA-F_]+(?:\.[0-9a-fA-F_]+)?(?:[pP][+-]?[0-9_]+)?|0[bB][01_]+|0[oO][0-7_]+|[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9_]+)?)/;

export class Tokenizer {
  private input: string;
  private length: number;
  private index = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    this.input = input;
    // Skip UTF-8 BOM if present
    if (input.startsWith("\uFEFF")) {
      this.index = 1;
    } else if (
      input.length >= 3 &&
      input.charCodeAt(0) === 0xef &&
      input.charCodeAt(1) === 0xbb &&
      input.charCodeAt(2) === 0xbf
    ) {
      this.index = 3;
    }
    this.length = input.length;
  }

  private peek(): string {
    if (this.index >= this.length) return "";
    return this.input[this.index];
  }

  private peekNext(): string {
    if (this.index + 1 >= this.length) return "";
    return this.input[this.index + 1];
  }

  private advance(): string {
    if (this.index >= this.length) return "";
    const char = this.input[this.index];
    this.index++;
    if (char === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return char;
  }

  private isAlpha(c: string): boolean {
    return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  }

  private isAlphanumeric(c: string): boolean {
    return this.isAlpha(c) || (c >= "0" && c <= "9");
  }

  private skipWhitespaceAndComments(): void {
    while (this.index < this.length) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        this.advance();
      } else if (c === "/" && this.peekNext() === "/") {
        // Line comment: skip until newline or EOF
        this.advance();
        this.advance();
        while (this.index < this.length) {
          const commentChar = this.peek();
          if (commentChar === "\n" || commentChar === "\r") {
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  public next(): Token {
    this.skipWhitespaceAndComments();

    const start = this.index;
    const line = this.line;
    const col = this.col;

    if (this.index >= this.length) {
      return {
        type: TokenType.Eof,
        value: "",
        start,
        end: start,
        line,
        col,
      };
    }

    const c = this.peek();

    // Multiline string
    if (c === "\\" && this.peekNext() === "\\") {
      this.advance();
      this.advance();
      while (this.index < this.length) {
        const nextC = this.peek();
        if (nextC === "\n" || nextC === "\r") {
          break;
        }
        this.advance();
      }
      return {
        type: TokenType.MultilineString,
        value: this.input.substring(start, this.index),
        start,
        end: this.index,
        line,
        col,
      };
    }

    // Symbol tokens
    switch (c) {
      case ".":
        this.advance();
        return {
          type: TokenType.Period,
          value: ".",
          start,
          end: this.index,
          line,
          col,
        };
      case "=":
        this.advance();
        return {
          type: TokenType.Equal,
          value: "=",
          start,
          end: this.index,
          line,
          col,
        };
      case ",":
        this.advance();
        return {
          type: TokenType.Comma,
          value: ",",
          start,
          end: this.index,
          line,
          col,
        };
      case "{":
        this.advance();
        return {
          type: TokenType.LBrace,
          value: "{",
          start,
          end: this.index,
          line,
          col,
        };
      case "}":
        this.advance();
        return {
          type: TokenType.RBrace,
          value: "}",
          start,
          end: this.index,
          line,
          col,
        };
      case "-":
        this.advance();
        return {
          type: TokenType.Minus,
          value: "-",
          start,
          end: this.index,
          line,
          col,
        };
      case "+":
        this.advance();
        return {
          type: TokenType.Plus,
          value: "+",
          start,
          end: this.index,
          line,
          col,
        };
    }

    // @"..." Identifier
    if (c === "@" && this.peekNext() === '"') {
      this.advance(); // @
      this.advance(); // "
      while (this.index < this.length) {
        const nextC = this.peek();
        if (nextC === '"') {
          this.advance(); // closing "
          return {
            type: TokenType.Identifier,
            value: this.input.substring(start, this.index),
            start,
            end: this.index,
            line,
            col,
          };
        } else if (nextC === "\\") {
          this.advance();
          if (this.index >= this.length) {
            throw new Error(
              `Unterminated escape sequence in identifier at line ${line}, col ${col}`,
            );
          }
          this.advance();
        } else if (nextC === "\n" || nextC === "\r") {
          throw new Error(
            `Unterminated identifier (newline found) at line ${line}, col ${col}`,
          );
        } else {
          this.advance();
        }
      }
      throw new Error(`Unterminated identifier at line ${line}, col ${col}`);
    }

    // String literal
    if (c === '"') {
      this.advance(); // "
      while (this.index < this.length) {
        const nextC = this.peek();
        if (nextC === '"') {
          this.advance(); // closing "
          return {
            type: TokenType.StringLiteral,
            value: this.input.substring(start, this.index),
            start,
            end: this.index,
            line,
            col,
          };
        } else if (nextC === "\\") {
          this.advance();
          if (this.index >= this.length) {
            throw new Error(
              `Unterminated escape sequence in string literal at line ${line}, col ${col}`,
            );
          }
          this.advance();
        } else if (nextC === "\n" || nextC === "\r") {
          throw new Error(
            `Unterminated string literal (newline found) at line ${line}, col ${col}`,
          );
        } else {
          this.advance();
        }
      }
      throw new Error(
        `Unterminated string literal at line ${line}, col ${col}`,
      );
    }

    // Character literal
    if (c === "'") {
      this.advance(); // '
      while (this.index < this.length) {
        const nextC = this.peek();
        if (nextC === "'") {
          this.advance(); // closing '
          return {
            type: TokenType.CharLiteral,
            value: this.input.substring(start, this.index),
            start,
            end: this.index,
            line,
            col,
          };
        } else if (nextC === "\\") {
          this.advance();
          if (this.index >= this.length) {
            throw new Error(
              `Unterminated escape sequence in character literal at line ${line}, col ${col}`,
            );
          }
          this.advance();
        } else if (nextC === "\n" || nextC === "\r") {
          throw new Error(
            `Unterminated character literal (newline found) at line ${line}, col ${col}`,
          );
        } else {
          this.advance();
        }
      }
      throw new Error(
        `Unterminated character literal at line ${line}, col ${col}`,
      );
    }

    // Number literal
    const remaining = this.input.substring(this.index);
    const numMatch = remaining.match(NUMBER_RE);
    if (numMatch) {
      const matchStr = numMatch[0];
      this.index += matchStr.length;
      this.col += matchStr.length;
      return {
        type: TokenType.NumberLiteral,
        value: matchStr,
        start,
        end: this.index,
        line,
        col,
      };
    }

    // Standard Identifier
    if (this.isAlpha(c)) {
      this.advance();
      while (this.index < this.length && this.isAlphanumeric(this.peek())) {
        this.advance();
      }
      return {
        type: TokenType.Identifier,
        value: this.input.substring(start, this.index),
        start,
        end: this.index,
        line,
        col,
      };
    }

    throw new Error(
      `Unexpected character ${JSON.stringify(c)} at line ${line}, col ${col}`,
    );
  }
}
