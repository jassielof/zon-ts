import { build, emptyDir } from "@deno/dnt";

await emptyDir("./node");

import DENO_JSON from "../deno.json" with { type: "json" };

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./node",
  test: false,
  typeCheck: false,
  skipNpmInstall: true,
  shims: {
    deno: false,
  },
  compilerOptions: {
    lib: ["ESNext", "DOM"],
    target: "Latest",
    skipLibCheck: true,
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
  },
  postBuild() {
    Deno.copyFileSync("./LICENSE.txt", "./node/LICENSE");
    Deno.copyFileSync("./README.md", "./node/README.md");
  },
});
