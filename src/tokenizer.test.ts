import { assertEquals, assertThrows } from "@std/assert";
import { Tokenizer, TokenType } from "./tokenizer.ts";

Deno.test("Tokenizer - Whitespace and Comments", () => {
  const code = `
    // this is a comment
    .name = "zon", // inline comment
  `;
  const tokenizer = new Tokenizer(code);

  const tok1 = tokenizer.next();
  assertEquals(tok1.type, TokenType.Period);

  const tok2 = tokenizer.next();
  assertEquals(tok2.type, TokenType.Identifier);
  assertEquals(tok2.value, "name");

  const tok3 = tokenizer.next();
  assertEquals(tok3.type, TokenType.Equal);

  const tok4 = tokenizer.next();
  assertEquals(tok4.type, TokenType.StringLiteral);
  assertEquals(tok4.value, '"zon"');

  const tok5 = tokenizer.next();
  assertEquals(tok5.type, TokenType.Comma);

  const tok6 = tokenizer.next();
  assertEquals(tok6.type, TokenType.Eof);
});

Deno.test("Tokenizer - Symbols", () => {
  const tokenizer = new Tokenizer(".={},-+");
  assertEquals(tokenizer.next().type, TokenType.Period);
  assertEquals(tokenizer.next().type, TokenType.Equal);
  assertEquals(tokenizer.next().type, TokenType.LBrace);
  assertEquals(tokenizer.next().type, TokenType.RBrace);
  assertEquals(tokenizer.next().type, TokenType.Comma);
  assertEquals(tokenizer.next().type, TokenType.Minus);
  assertEquals(tokenizer.next().type, TokenType.Plus);
  assertEquals(tokenizer.next().type, TokenType.Eof);
});

Deno.test("Tokenizer - Identifiers", () => {
  const tokenizer = new Tokenizer(`foo bar @"escaped field"`);

  const tok1 = tokenizer.next();
  assertEquals(tok1.type, TokenType.Identifier);
  assertEquals(tok1.value, "foo");

  const tok2 = tokenizer.next();
  assertEquals(tok2.type, TokenType.Identifier);
  assertEquals(tok2.value, "bar");

  const tok3 = tokenizer.next();
  assertEquals(tok3.type, TokenType.Identifier);
  assertEquals(tok3.value, '@"escaped field"');
});

Deno.test("Tokenizer - Strings & Characters", () => {
  const tokenizer = new Tokenizer(`"str" 'c' "\\n" '\\t'`);

  assertEquals(tokenizer.next().value, '"str"');
  assertEquals(tokenizer.next().value, "'c'");
  assertEquals(tokenizer.next().value, '"\\n"');
  assertEquals(tokenizer.next().value, "'\\t'");
});

Deno.test("Tokenizer - Multiline Strings", () => {
  const tokenizer = new Tokenizer(`\\\\line 1\n\\\\line 2`);

  const tok1 = tokenizer.next();
  assertEquals(tok1.type, TokenType.MultilineString);
  assertEquals(tok1.value, "\\\\line 1");

  const tok2 = tokenizer.next();
  assertEquals(tok2.type, TokenType.MultilineString);
  assertEquals(tok2.value, "\\\\line 2");
});

Deno.test("Tokenizer - Number Literals", () => {
  const cases = [
    "123",
    "1_000",
    "0.123",
    "0x1.a2p+3",
    "0b1010",
    "0o777",
    "0xf25cae59b814c9e6",
  ];
  for (const c of cases) {
    const tokenizer = new Tokenizer(c);
    const tok = tokenizer.next();
    assertEquals(tok.type, TokenType.NumberLiteral);
    assertEquals(tok.value, c);
  }
});

Deno.test("Tokenizer - Errors", () => {
  assertThrows(() => new Tokenizer('"unterminated').next());
  assertThrows(() => new Tokenizer("'unterminated").next());
  assertThrows(() => new Tokenizer('@"unterminated').next());
  assertThrows(() => new Tokenizer(`"unterminated\nnewline"`).next());
});
