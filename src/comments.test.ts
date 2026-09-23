import { assertEquals } from "@std/assert";
import { parse } from "./parse.ts";
import { stringify } from "./stringify.ts";
import {
  EnumLiteral,
  HexLiteral,
  type Manifest,
  type ParseResult,
} from "./types.ts";

Deno.test("Comments - default parsing ignores comments with zero overhead", () => {
  const zon = `
    // leading line comment
    /// doc comment
    .{
        // field line comment
        .name = "zon", // trailing comment
        .version = "1.0.0",
    }
  `;
  const result = parse(zon);
  assertEquals(result, { name: "zon", version: "1.0.0" });
  // Ensure result is a plain object without comments wrapper
  assertEquals((result as ParseResult).comments, undefined);
});

Deno.test("Comments - fileDoc comments (//!) collection", () => {
  const zon = `//! Package root documentation
//! Another file doc line
.{
    .name = "my_pkg",
}`;
  const result = parse(zon, { preserveComments: true });
  assertEquals(result.value, { name: "my_pkg" });
  assertEquals(result.comments.fileDoc, [
    " Package root documentation",
    " Another file doc line",
  ]);
});

Deno.test("Comments - leading, trailing, and doc comments on struct fields", () => {
  const zon = `.{
    // Line comment before name
    .name = .docent, // Trailing comment on name
    /// Doc comment for version
    .version = "0.0.0",
}`;
  const result = parse(zon, { preserveComments: true });
  assertEquals(result.value, {
    name: new EnumLiteral("docent"),
    version: "0.0.0",
  });

  const nameComments = result.comments.nodes.get(".name");
  assertEquals(nameComments?.leading, [
    { kind: "line", text: " Line comment before name" },
  ]);
  assertEquals(nameComments?.trailing, {
    kind: "line",
    text: " Trailing comment on name",
  });

  const versionComments = result.comments.nodes.get(".version");
  assertEquals(versionComments?.leading, [
    { kind: "doc", text: " Doc comment for version" },
  ]);
});

Deno.test("Comments - array element leading and trailing comments", () => {
  const zon = `.{
    .paths = .{
        // First path
        "build.zig", // build script
        // Second path
        "README.md",
    },
}`;
  const result = parse(zon, { preserveComments: true });
  const p0 = result.comments.nodes.get(".paths[0]");
  assertEquals(p0?.leading, [{ kind: "line", text: " First path" }]);
  assertEquals(p0?.trailing, { kind: "line", text: " build script" });

  const p1 = result.comments.nodes.get(".paths[1]");
  assertEquals(p1?.leading, [{ kind: "line", text: " Second path" }]);
});

Deno.test("Comments - inner comments before closing brace", () => {
  const zon = `.{
    .paths = .{
        "src",
        // Inner comment in paths
    },
    // Inner comment in root
}`;
  const result = parse(zon, { preserveComments: true });
  const pathsComments = result.comments.nodes.get(".paths");
  assertEquals(pathsComments?.inner, [
    { kind: "line", text: " Inner comment in paths" },
  ]);

  const rootComments = result.comments.nodes.get("");
  assertEquals(rootComments?.inner, [
    { kind: "line", text: " Inner comment in root" },
  ]);
});

Deno.test("Comments - inner comments in empty struct/array", () => {
  const zon = `.{
    .empty_struct = .{
        // nothing here yet
    },
}`;
  const result = parse(zon, { preserveComments: true });
  const emptyComments = result.comments.nodes.get(".empty_struct");
  assertEquals(emptyComments?.inner, [
    { kind: "line", text: " nothing here yet" },
  ]);

  const stringified = stringify(result, { space: 4 });
  const expected = `.{
    .empty_struct = .{
        // nothing here yet
    },
}`;
  assertEquals(stringified, expected);
});

Deno.test("Comments - selective preservation options", () => {
  const zon = `//! File doc
.{
    // Normal comment
    .name = "pkg",
    /// Doc comment
    .version = "1.0.0",
}`;

  // Preserve only doc comments
  const docOnly = parse(zon, {
    preserveComments: { normal: false, doc: true, fileDoc: false },
  });
  assertEquals(docOnly.comments.fileDoc, []);
  assertEquals(docOnly.comments.nodes.get(".name"), undefined);
  assertEquals(docOnly.comments.nodes.get(".version")?.leading, [
    { kind: "doc", text: " Doc comment" },
  ]);

  // Preserve only file doc comments
  const fileOnly = parse(zon, {
    preserveComments: { normal: false, doc: false, fileDoc: true },
  });
  assertEquals(fileOnly.comments.fileDoc, [" File doc"]);
  assertEquals(fileOnly.comments.nodes.size, 0);
});

Deno.test("Comments - roundtrip stringify with comments", () => {
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

  const parsed = parse<Manifest>(original, {
    preserveComments: true,
    hexLiteral: "class",
  });
  assertEquals(parsed.value.fingerprint, new HexLiteral("0xf25cae59b814c9e6"));

  // Stringify using ParseResult directly
  const output = stringify(parsed, { space: 4 });
  assertEquals(output, original);

  // Stringify passing value + comments option explicitly
  const outputExplicit = stringify(parsed.value, {
    space: 4,
    comments: parsed.comments,
  });
  assertEquals(outputExplicit, original);
});

Deno.test("Comments - complex manifest with multiple comment kinds roundtrip", () => {
  const zon = `//! Zig Package Manifest
.{
    // Package identifier
    .name = .docent,
    .version = "0.0.0",
    .fingerprint = 0xf25cae59b814c9e6,
    .dependencies = .{
        .fangz = .{
            .path = "dependencies/fangz",
        },
    },
    .minimum_zig_version = "0.16.0",
    .paths = .{
        "build.zig",
        "README.md", // primary documentation
    },
}`;

  const parsed = parse<Manifest>(zon, {
    preserveComments: true,
    hexLiteral: "class",
  });
  const formatted = stringify(parsed, { space: 4 });
  assertEquals(formatted, zon);
});
