// Local audit only: generates a production bundle in memory, never publishes it.
import { build } from "vite";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const output = resolve(process.argv[2] || "bundle-audit.json");
const result = await build({ mode: "production", build: { write: false } });
const chunks = (Array.isArray(result) ? result : [result])
  .flatMap((r) => r.output)
  .filter((r) => r.type === "chunk");
const byFile = new Map(chunks.map((c) => [c.fileName, c]));
const closure = (entry, seen = new Set()) => {
  if (seen.has(entry) || !byFile.has(entry)) return seen;
  seen.add(entry);
  for (const child of byFile.get(entry).imports) closure(child, seen);
  return seen;
};
const name = (id) => {
  const marker = id.lastIndexOf("node_modules/");
  return marker >= 0
    ? id.slice(marker)
    : id.startsWith(process.cwd() + "/")
      ? id.slice(process.cwd().length + 1)
      : id.replace(process.cwd(), "");
};
const entries = chunks
  .filter((c) => c.isEntry)
  .map((c) => {
    const files = [...closure(c.fileName)],
      modules = files.flatMap((file) =>
        Object.entries(byFile.get(file).modules).map(([id, m]) => ({
          id: name(id),
          renderedBytes: m.renderedLength,
        })),
      );
    return {
      entry: c.fileName,
      initialJavaScriptFiles: files,
      rawBytes: files.reduce(
        (n, f) => n + Buffer.byteLength(byFile.get(f).code),
        0,
      ),
      gzipBytes: files.reduce(
        (n, f) => n + gzipSync(byFile.get(f).code).length,
        0,
      ),
      topModules: modules
        .sort((a, b) => b.renderedBytes - a.renderedBytes)
        .slice(0, 60),
    };
  });
writeFileSync(
  output,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      head: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      metric:
        "Entry JavaScript plus recursive static chunk imports; gzip summed per file. Module rendered length is not attribution of minified/gzip size. CSS/assets/dynamic routes excluded.",
      entries,
      chunks: chunks.map((c) => ({
        file: c.fileName,
        isEntry: c.isEntry,
        rawBytes: Buffer.byteLength(c.code),
        gzipBytes: gzipSync(c.code).length,
        imports: c.imports,
        dynamicImports: c.dynamicImports,
        modules: Object.entries(c.modules).map(([id, m]) => ({
          id: name(id),
          renderedBytes: m.renderedLength,
        })),
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ output, entries: entries.map(({ topModules, ...e }) => e) }),
);
