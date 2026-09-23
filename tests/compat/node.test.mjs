import test from "node:test";
import assert from "node:assert/strict";
import {
  parse,
  stringify,
  EnumLiteral,
  CharLiteral,
  HexLiteral,
  Tokenizer,
  TokenType,
} from "../../node/esm/mod.js";

test("parse primitives and structures", () => {
  assert.equal(parse("true"), true);
  assert.equal(parse("null"), null);
  assert.equal(parse("123_456"), 123456);

  const parsed = parse('.{ .name = .test, .paths = .{ "a", "b" } }');
  assert.ok(parsed.name instanceof EnumLiteral);
  assert.equal(parsed.name.value, "test");
  assert.deepEqual(parsed.paths, ["a", "b"]);
});

test("stringify with formatting", () => {
  const val = {
    const: 1,
    "hyphen-name": "ok",
    char: new CharLiteral("A"),
  };
  const res = stringify(val);
  assert.equal(res, '.{.@"const"=1,.@"hyphen-name"="ok",.char=\'A\'}');
});

test("BigInt support", () => {
  const big = parse("0xf25cae59b814c9e6");
  assert.equal(typeof big, "bigint");
  assert.equal(big, 17464025155399633382n);
  assert.equal(stringify(big), "17464025155399633382");
});

test("multiline strings", () => {
  const zon = `\\\\first line\n\\\\second line`;
  assert.equal(parse(zon), "first line\nsecond line");
});

test("Tokenizer scan", () => {
  const tokenizer = new Tokenizer(".hello");
  const tok1 = tokenizer.next();
  assert.equal(tok1.type, TokenType.Period);
  const tok2 = tokenizer.next();
  assert.equal(tok2.type, TokenType.Identifier);
  assert.equal(tok2.value, "hello");
});

test("HexLiteral roundtrip", () => {
  const parsed = parse(".{ .fingerprint = 0xf25cae59b814c9e6 }", {
    hexLiteral: "class",
  });
  assert.ok(parsed.fingerprint instanceof HexLiteral);
  assert.equal(parsed.fingerprint.toString(), "0xf25cae59b814c9e6");
  const output = stringify(parsed);
  assert.equal(output, ".{.fingerprint=0xf25cae59b814c9e6}");
});

test("Comment preservation roundtrip", () => {
  const original = `//! Package manifest for docent
.{
    // Project name
    .name = .docent, // trailing name
    /// Semantic version
    .version = "0.0.0",
    .fingerprint = 0xf25cae59b814c9e6,
    .dependencies = .{
        // Main dependency
        .fangz = .{
            .path = "dependencies/fangz",
        },
    },
    .paths = .{
        // Path files
        "build.zig",
        "README.md", // markdown docs
        // End of paths
    },
    // End of manifest
}`;

  const parsed = parse(original, {
    preserveComments: true,
    hexLiteral: "class",
  });
  assert.equal(parsed.value.name.value, "docent");
  assert.deepEqual(parsed.comments.fileDoc, [" Package manifest for docent"]);
  assert.equal(
    parsed.comments.nodes.get(".name").trailing.text,
    " trailing name",
  );

  const formatted = stringify(parsed, { space: 4 });
  assert.equal(formatted, original);
});
