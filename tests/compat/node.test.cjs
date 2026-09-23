const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parse,
  stringify,
  EnumLiteral,
  CharLiteral,
  Tokenizer,
  TokenType,
} = require("../../node");

test("parse primitives and structures", () => {
  assert.equal(parse("true"), true);
  assert.equal(parse("false"), false);
  assert.equal(parse("null"), null);
  assert.equal(parse("42"), 42);
  assert.equal(parse("-17.5"), -17.5);
  assert.equal(parse('"hello world"'), "hello world");

  const struct = parse(
    '.{ .name = "zon", .version = "0.1.0", .tags = .{ 1, 2 } }',
  );
  assert.deepEqual(struct, {
    name: "zon",
    version: "0.1.0",
    tags: [1, 2],
  });
});

test("EnumLiteral and CharLiteral", () => {
  const parsedEnum = parse(".active");
  assert.ok(parsedEnum instanceof EnumLiteral);
  assert.equal(parsedEnum.value, "active");
  assert.equal(parsedEnum.toString(), ".active");

  const parsedChar = parse("'z'");
  assert.ok(parsedChar instanceof CharLiteral);
  assert.equal(parsedChar.value, "z");
  assert.equal(parsedChar.toString(), "'z'");
});

test("parse options", () => {
  const parsed = parse(".{ .mode = .release, .char = 'c' }", {
    enumLiteral: "string",
    charLiteral: "string",
  });
  assert.deepEqual(parsed, { mode: "release", char: "c" });
});

test("stringify", () => {
  const data = {
    name: new EnumLiteral("zon"),
    count: 3,
    paths: ["src", "tests"],
  };
  const compact = stringify(data);
  assert.equal(compact, '.{.name=.zon,.count=3,.paths=.{"src","tests"}}');

  const pretty = stringify(data, { space: 2 });
  assert.ok(pretty.includes("\n"));
  assert.ok(pretty.includes("  .name = .zon"));
});

test("Tokenizer", () => {
  const tokenizer = new Tokenizer(".{ .a = 1 }");
  const tok1 = tokenizer.next();
  assert.equal(tok1.type, TokenType.Period);
  const tok2 = tokenizer.next();
  assert.equal(tok2.type, TokenType.LBrace);
});
