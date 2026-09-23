import { describe, expect, test } from "bun:test";
import {
  CharLiteral,
  EnumLiteral,
  HexLiteral,
  parse,
  stringify,
  Tokenizer,
  TokenType,
} from "../../src/mod.ts";
import * as packaged from "../../node/esm/mod.js";

describe("Direct TypeScript Source", () => {
  test("parses primitives and complex structs", () => {
    expect(parse("true")).toBe(true);
    expect(parse("false")).toBe(false);
    expect(parse("null")).toBe(null);
    expect(parse("0x1.a2p+3")).toBe(13.0625);

    const data = parse<{ name: EnumLiteral; version: string; paths: string[] }>(
      '.{ .name = .zig, .version = "0.16.0", .paths = .{ "src" } }',
    );
    expect(data.name).toBeInstanceOf(EnumLiteral);
    expect(data.name.toString()).toBe(".zig");
    expect(data.version).toBe("0.16.0");
    expect(data.paths).toEqual(["src"]);
  });

  test("stringifies with options", () => {
    const obj = {
      name: new EnumLiteral("bun"),
      fast: true,
      char: new CharLiteral("!"),
    };
    const out = stringify(obj, { space: 2 });
    expect(out).toContain(".name = .bun");
    expect(out).toContain(".fast = true");
    expect(out).toContain(".char = '!'");
  });

  test("roundtrips arbitrary ZON", () => {
    const input = `.{
  .name = "zon-compat",
  .values = .{ 1, 2, 3 },
  .active = true,
}`;
    const parsed = parse(input);
    const serialized = stringify(parsed, { space: 2 });
    expect(parse(serialized)).toEqual(parsed);
  });

  test("tokenizes input", () => {
    const tokenizer = new Tokenizer(".{ .version = 1 }");
    expect(tokenizer.next().type).toBe(TokenType.Period);
    expect(tokenizer.next().type).toBe(TokenType.LBrace);
  });

  test("preserves HexLiteral roundtrip", () => {
    const data = parse<{ fingerprint: HexLiteral }>(
      ".{ .fingerprint = 0xf25cae59b814c9e6 }",
      { hexLiteral: "class" },
    );
    expect(data.fingerprint).toBeInstanceOf(HexLiteral);
    expect(data.fingerprint.toString()).toBe("0xf25cae59b814c9e6");
    expect(stringify(data)).toBe(".{.fingerprint=0xf25cae59b814c9e6}");
  });
});

describe("Built Package Artifact", () => {
  test("consumes built ESM package artifact", () => {
    expect(packaged.parse("100")).toBe(100);
    const parsed = packaged.parse(".{ .target = .bun }", {
      enumLiteral: "string",
    });
    expect(parsed).toEqual({ target: "bun" });

    const hex = packaged.parse("0xf25cae59b814c9e6", { hexLiteral: "class" });
    expect(hex).toBeInstanceOf(packaged.HexLiteral);
    expect(packaged.stringify(hex)).toBe("0xf25cae59b814c9e6");
  });
});
