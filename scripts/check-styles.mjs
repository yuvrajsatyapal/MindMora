import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name),
      ),
    )
  ).flat();
}
const errors = [];
for (const file of await walk("src")) {
  if (
    !/\.(css|tsx)$/.test(file) ||
    file.endsWith(".test.tsx") ||
    file.endsWith("tokens.css")
  )
    continue;
  const text = await readFile(file, "utf8");
  const rules = [
    [
      /#[\da-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/,
      "Raw color: add or consume a semantic token",
    ],
    [/\bstyle\s*=\s*\{/, "Inline style: use a token-backed class"],
    [
      /\b(?:bg|text|p|px|py|m|gap|rounded|shadow|w|h)-\[/,
      "Arbitrary utility: add a named token",
    ],
  ];
  for (const [pattern, message] of rules)
    if (pattern.test(text)) errors.push(`${file}: ${message}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Style contract passed: no raw colors, inline styles or arbitrary utilities.",
  );
