import { assertEquals, assertThrows } from "@std/assert";
import { parse } from "./parse.ts";
import { CharLiteral, EnumLiteral } from "./types.ts";

Deno.test("Primitives", () => {
  assertEquals(parse("true"), true);
  assertEquals(parse("false"), false);
  assertEquals(parse("null"), null);
  assertEquals(parse("123"), 123);
  assertEquals(parse("-123"), -123);
  assertEquals(parse("1_000_000"), 1000000);
  assertEquals(parse("12.34"), 12.34);
  assertEquals(parse("-12.34"), -12.34);
  assertEquals(parse("1e3"), 1000);
  assertEquals(parse("0b1010"), 10);
  assertEquals(parse("0o777"), 511);
  assertEquals(parse("0xff"), 255);
});

Deno.test("Hex float", () => {
  // 0x1.a2p+3 is 1.6328125 * 8 = 13.0625
  assertEquals(parse("0x1.a2p+3"), 13.0625);
  // 0x1.5p-2 is 1.3125 * 0.25 = 0.328125
  assertEquals(parse("0x1.5p-2"), 0.328125);
});

Deno.test("Strings and escapes", () => {
  assertEquals(parse('"hello"'), "hello");
  assertEquals(parse('"hello\\nworld"'), "hello\nworld");
  assertEquals(parse('"hello\\rworld"'), "hello\rworld");
  assertEquals(parse('"hello\\tworld"'), "hello\tworld");
  assertEquals(parse('"hello\\\\world"'), "hello\\world");
  assertEquals(parse('"hello\\"world"'), 'hello"world');
  assertEquals(parse('"\\x41"'), "A");
  assertEquals(parse('"\\u{1f600}"'), "😀");
});

Deno.test("Multiline Strings", () => {
  const code = `
    \\\\hello
    \\\\world
  `;
  assertEquals(parse(code), "hello\nworld");
});

Deno.test("Enum Literals", () => {
  // Default (class)
  const result1 = parse(".foo");
  assertEquals(result1 instanceof EnumLiteral, true);
  assertEquals((result1 as EnumLiteral).value, "foo");

  // String option
  assertEquals(parse(".foo", { enumLiteral: "string" }), "foo");

  // Prefix option
  assertEquals(parse(".foo", { enumLiteral: "prefix" }), ".foo");

  // Escaped enum literals
  const resultEscaped = parse('.@"foo-bar"');
  assertEquals(resultEscaped instanceof EnumLiteral, true);
  assertEquals((resultEscaped as EnumLiteral).value, "foo-bar");
});

Deno.test("Character Literals", () => {
  // Default (class)
  const result1 = parse("'a'");
  assertEquals(result1 instanceof CharLiteral, true);
  assertEquals((result1 as CharLiteral).value, "a");

  // String option
  assertEquals(parse("'a'", { charLiteral: "string" }), "a");

  // Number option
  assertEquals(parse("'a'", { charLiteral: "number" }), 97);

  // Escapes in character literals
  const resultEsc = parse("'\\n'");
  assertEquals((resultEsc as CharLiteral).value, "\n");
});

Deno.test("BigInt limits", () => {
  // safe integer limit
  assertEquals(parse("9007199254740991"), 9007199254740991);
  // above safe integer limit -> BigInt by default
  assertEquals(parse("9007199254740992"), 9007199254740992n);
  assertEquals(
    parse("0xf25cae59b814c9e6"),
    17464025155399633382n,
  );

  // BigInt as string option
  assertEquals(
    parse("0xf25cae59b814c9e6", { bigint: "string" }),
    "17464025155399633382",
  );
  // BigInt as number option (may lose precision)
  assertEquals(
    parse("0xf25cae59b814c9e6", { bigint: "number" }),
    17464025155399633000,
  );
});

Deno.test("Arrays and Structs", () => {
  const structCode = `.{
    .name = "zon",
    .version = "1.0.0",
    .dependencies = .{
      .dep1 = .{ .path = "libs/dep1" },
    },
    .paths = .{
      "src",
      "LICENSE",
    },
  }`;

  // deno-lint-ignore no-explicit-any
  const parsed = parse<any>(structCode);
  assertEquals(parsed.name, "zon");
  assertEquals(parsed.version, "1.0.0");
  assertEquals(parsed.dependencies.dep1.path, "libs/dep1");
  assertEquals(parsed.paths, ["src", "LICENSE"]);
});

Deno.test("Syntax Errors", () => {
  assertThrows(() => parse("true false"));
  assertThrows(() => parse(".{ .name = }"));
  assertThrows(() => parse(".{ .name = 123"));
  assertThrows(() => parse(".{ 1, 2, .name = 3 }"));
  assertThrows(() => parse(".{ .name = 1, .name = 2 }"));
});

Deno.test("special field names cannot mutate prototypes", () => {
  const parsed = parse<Record<string, unknown>>(
    `.{ .@"__proto__" = .{ .polluted = true }, .@"constructor" = 1 }`,
  );
  assertEquals(Object.getPrototypeOf(parsed), Object.prototype);
  assertEquals(Object.hasOwn(parsed, "__proto__"), true);
  assertEquals(({} as { polluted?: boolean }).polluted, undefined);
  assertEquals(parsed["constructor"], 1);
});

Deno.test("character number uses a Unicode code point", () => {
  assertEquals(parse("'😀'", { charLiteral: "number" }), 0x1f600);
  assertThrows(() => parse("''"));
  assertThrows(() => parse("'ab'"));
  assertThrows(() => parse("'\\u{d800}'"));
});
