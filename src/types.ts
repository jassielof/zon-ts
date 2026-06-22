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
