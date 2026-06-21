import { build, emptyDir } from "@deno/dnt";

await emptyDir("./node");

import DENO_JSON from "../deno.json" with { type: "json" };

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./node",
  shims: {
    deno: true,
  },
  package: {
    name: DENO_JSON.name,
    version: DENO_JSON.version,
  },
  postBuild() {
    Deno.copyFileSync("./LICENSE", "./node/LICENSE");
    Deno.copyFileSync("./README.md", "./node/README.md");
  },
});
