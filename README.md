# zon-ts

A small TypeScript parser and serializer for Zig Object Notation (ZON). It runs
on Deno and is packaged for Node with `dnt`.

```ts
import { parse, stringify } from "@jassielof/zon";

const manifest = parse<{ minimum_zig_version?: string }>(
  await Deno.readTextFile("build.zig.zon"),
);

const text = stringify({
  name: "example",
  paths: ["src", "build.zig"],
}, { space: 4 });
```

`parse` supports ZON structs, arrays, strings (including multiline strings),
character and enum literals, integers, floats, booleans, null, `nan`, and
infinities. Large integers return `bigint` by default. Enum and character
literals use `EnumLiteral` and `CharLiteral` wrapper classes unless an alternate
representation is selected through `ParseOptions`.

```sh
deno task test
deno task check
deno task pack
```

See Zig's
[`std.zon` documentation](https://ziglang.org/documentation/0.16.0/std/#std.zon)
for the format itself.
