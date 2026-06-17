import { assertEquals } from "@std/assert";
import { parse, stringify } from "../src/mod.ts";
import { CharLiteral, EnumLiteral } from "../src/types.ts";

function toJSONString(val: unknown): string {
  return JSON.stringify(
    val,
    (_key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      if (value instanceof EnumLiteral || value instanceof CharLiteral) {
        return value.toString();
      }
      if (typeof value === "number") {
        if (Number.isNaN(value)) return "nan";
        if (value === Infinity) return "inf";
        if (value === -Infinity) return "-inf";
      }
      return value;
    },
    2,
  );
}

Deno.test("Integration - Specific Assertions", async () => {
  // Explicit assertions for build.zig.zon
  // deno-lint-ignore no-explicit-any
  const buildZon = parse<any>(
    await Deno.readTextFile("./tests/fixtures/build.zig.zon"),
  );
  assertEquals(buildZon.name instanceof EnumLiteral, true);
  assertEquals((buildZon.name as EnumLiteral).value, "docent");
  assertEquals(buildZon.fingerprint, 17464025155399633382n);
  assertEquals(buildZon.dependencies.fangz.path, "dependencies/fangz");

  // Explicit assertions for env.zon
  // deno-lint-ignore no-explicit-any
  const envZon = parse<any>(
    await Deno.readTextFile("./tests/fixtures/env.zon"),
  );
  assertEquals(envZon.version, "0.16.0");
  assertEquals(envZon.env.ZIG_GLOBAL_CACHE_DIR, "D:/zig-cache/global/");
});

Deno.test("Integration - Dynamic Fixtures Roundtrip", async () => {
  const dir = "./tests/fixtures";
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && entry.name.endsWith(".zon")) {
      const zonName = entry.name;
      const jsonName = zonName.slice(0, -4) + ".json";

      const zonPath = `${dir}/${zonName}`;
      const jsonPath = `${dir}/${jsonName}`;

      const zonText = await Deno.readTextFile(zonPath);
      const parsed = parse(zonText);

      // Write JSON representation
      const jsonText = toJSONString(parsed);
      await Deno.writeTextFile(jsonPath, jsonText + "\n");

      // Roundtrip
      const stringifiedZon = stringify(parsed, { space: 4 });
      const reParsed = parse(stringifiedZon);

      assertEquals(
        reParsed,
        parsed,
        `Failed roundtrip for fixture: ${zonName}`,
      );
    }
  }
});
