import { build, emptyDir } from "@deno/dnt";

await emptyDir("./node");

import DENO_JSON from "../deno.json" with { type: "json" };

function copyDirSync(src: string, dest: string) {
  Deno.mkdirSync(dest, { recursive: true });
  for (const entry of Deno.readDirSync(src)) {
    const srcPath = `${src}/${entry.name}`;
    const destPath = `${dest}/${entry.name}`;
    if (entry.isDirectory) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isFile) {
      Deno.copyFileSync(srcPath, destPath);
    }
  }
}

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./node",
  shims: {
    deno: true,
  },
  compilerOptions: {
    lib: ["ESNext", "DOM"],
    target: "Latest",
  },
  package: {
    name: DENO_JSON.name,
    license: DENO_JSON.license,
    version: DENO_JSON.version,
    scripts: {
      pack: "deno task pack",
      prepare: "pnpm run pack",
    },
  },
  postBuild() {
    Deno.copyFileSync("./LICENSE.txt", "./node/LICENSE");
    Deno.copyFileSync("./README.md", "./node/README.md");
    copyDirSync("./tests/fixtures", "./node/script/tests/fixtures");
    copyDirSync("./tests/fixtures", "./node/esm/tests/fixtures");
  },
});
