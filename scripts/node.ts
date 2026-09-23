import { build, emptyDir } from "@deno/dnt";

await emptyDir("./node");

import DENO_JSON from "../deno.json" with { type: "json" };

await build({
  entryPoints: [
    "./src/mod.ts",
    "./src/parse.ts",
    "./src/types.ts",
    "./src/stringify.ts",
  ],
  outDir: "./node",
  shims: {
    deno: true,
  },
  test: false,
  compilerOptions: {
    lib: ["ESNext", "DOM"],
    target: "Latest",
  },
  package: {
    name: DENO_JSON.name,
    license: DENO_JSON.license,
    version: DENO_JSON.version,
    author: "Jassiel Ovando",
    description:
      "A TypeScript library for de/serializing Zig Object Notation (ZON).",
    repository: {
      type: "git",
      url: "https://github.com/jassielof/zon-ts.git",
    },
    bugs: {
      url: "https://github.com/jassielof/zon-ts/issues",
    },
    homepage: "https://github.com/jassielof/zon-ts",
  },
});

await Deno.copyFile("./LICENSE.txt", "./node/LICENSE");
await Deno.copyFile("./README.md", "./node/README.md");
