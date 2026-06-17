/**
 * Represents a Zig enum literal (e.g., `.docent` or `.@"some name"`).
 */
export class EnumLiteral {
  public readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return `.${this.value}`;
  }

  toJSON(): string {
    return `.${this.value}`;
  }
}

/**
 * Represents a Zig character literal (e.g., `'a'` or `'\n'`).
 */
export class CharLiteral {
  public readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return `'${this.value}'`;
  }

  toJSON(): string {
    return this.value;
  }
}

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
