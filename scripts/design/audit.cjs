// Prevent further native-button proliferation while preserving an explicit legacy inventory.
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../..");
function scan(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? scan(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const rows = Object.fromEntries(
  scan(path.join(root, "src"))
    .filter((f) => /\.tsx$/.test(f) && !/(\.test\.|\.spec\.|__tests__)/.test(f))
    .map((f) => [
      path.relative(root, f),
      (fs.readFileSync(f, "utf8").match(/<button\b/g) || []).length,
    ])
    .filter(([, n]) => n),
);
const baselinePath = path.join(__dirname, "legacy-buttons.json");
if (process.argv.includes("--baseline")) {
  fs.writeFileSync(baselinePath, JSON.stringify(rows, null, 2) + "\n");
  process.exit(0);
}
const postcss = require("postcss");
const styles = scan(path.join(root, "src")).filter((f) => f.endsWith(".css"));
const definitions = new Set();
const references = [];
for (const file of styles) {
  const css = postcss.parse(fs.readFileSync(file, "utf8"), { from: file });
  css.walkDecls((decl) => {
    if (decl.prop.startsWith("--re-")) definitions.add(decl.prop);
    for (const match of decl.value.matchAll(/var\((--re-[\w-]+)/g))
      references.push({ file: path.relative(root, file), token: match[1] });
  });
}
const unresolved = references.filter((ref) => !definitions.has(ref.token));
if (unresolved.length) {
  console.error("Undefined design tokens:", unresolved);
  process.exitCode = 1;
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const growth = Object.entries(rows).filter(([f, n]) => n > (baseline[f] || 0));
console.log(
  JSON.stringify(
    {
      legacyNativeButtons: Object.values(rows).reduce((a, b) => a + b, 0),
      files: Object.keys(rows).length,
      newOneOffButtons: growth,
      unresolvedDesignTokens: unresolved,
    },
    null,
    2,
  ),
);
if (growth.length && !process.argv.includes("--report")) {
  console.error(
    "Use AppleButton/shared UI primitives; migrate existing buttons instead of adding one-offs. See src/design/README.md.",
  );
  process.exitCode = 1;
}
