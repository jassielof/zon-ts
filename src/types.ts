/**
 * Represents a Zig enum literal (e.g., `.docent` or `.@"some name"`).
 */
export class EnumLiteral {
  /** The value of the enum literal (without the leading dot). */
  public readonly value: string;

  /**
   * Creates an instance of EnumLiteral.
   * @param value The value of the enum literal.
   */
  constructor(value: string) {
    this.value = value;
  }

  /**
   * Returns the string representation of the enum literal (with a leading dot).
   * @returns The string representation.
   */
  toString(): string {
    return `.${this.value}`;
  }

  /**
   * Returns the JSON string representation of the enum literal (with a leading dot).
   * @returns The JSON representation.
   */
  toJSON(): string {
    return `.${this.value}`;
  }
}

/**
 * Represents a Zig character literal (e.g., `'a'` or `'\n'`).
 */
export class CharLiteral {
  /** The value of the character literal (without the quotes). */
  public readonly value: string;

  /**
   * Creates an instance of CharLiteral.
   * @param value The value of the character literal.
   */
  constructor(value: string) {
    this.value = value;
  }

  /**
   * Returns the string representation of the character literal (wrapped in single quotes).
   * @returns The string representation.
   */
  toString(): string {
    return `'${this.value}'`;
  }

  /**
   * Returns the JSON string representation of the character literal.
   * @returns The JSON representation.
   */
  toJSON(): string {
    return this.value;
  }
}
