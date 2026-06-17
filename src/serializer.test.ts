import { assertEquals } from "@std/assert";
import { stringify } from "./serializer.ts";
import { CharLiteral, EnumLiteral } from "./types.ts";

Deno.test("Serializer - Basic", () => {
  assertEquals(stringify(true), "true");
  assertEquals(stringify(false), "false");
  assertEquals(stringify(null), "null");
  assertEquals(stringify(123), "123");
  assertEquals(stringify(17464025155399633382n), "17464025155399633382");
  assertEquals(stringify("hello"), '"hello"');
  assertEquals(stringify(new EnumLiteral("docent")), ".docent");
  assertEquals(stringify(new CharLiteral("\n")), "'\\n'");
});

Deno.test("Serializer - Structs and Arrays", () => {
  const val = {
    name: new EnumLiteral("docent"),
    description: "Doc linter",
    version: "0.0.0",
    paths: ["build.zig", "build.zig.zon"],
  };

  // Compact
  assertEquals(
    stringify(val),
    `.{.name=.docent,.description="Doc linter",.version="0.0.0",.paths=.{"build.zig","build.zig.zon"}}`,
  );

  // Pretty
  const expectedPretty = `.{
    .name = .docent,
    .description = "Doc linter",
    .version = "0.0.0",
    .paths = .{
        "build.zig",
        "build.zig.zon",
    },
}`;
  assertEquals(stringify(val, { space: 4 }), expectedPretty);
});

Deno.test("Serializer - Keyword and Ident escaping", () => {
  const val = {
    const: 123,
    "invalid-name": "yes",
  };
  assertEquals(stringify(val), `.{.@"const"=123,.@"invalid-name"="yes"}`);
});

Deno.test("Serializer - toJSON Support", () => {
  const custom = {
    value: "inner",
    toJSON() {
      return this.value;
    },
  };
  assertEquals(stringify(custom), '"inner"');
});

Deno.test("Serializer - Replacer Function", () => {
  const val = {
    a: 1,
    b: 2,
  };
  const result = stringify(val, {
    replacer(key, value) {
      if (key === "a") return undefined; // Filter out
      if (key === "b") return (value as number) * 10;
      return value;
    },
  });
  assertEquals(result, `.{.b=20}`);
});
