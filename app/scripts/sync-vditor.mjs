import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";

const packageRoot = fileURLToPath(
  new URL("../node_modules/vditor/", import.meta.url),
);
const source = fileURLToPath(
  new URL("../node_modules/vditor/dist/", import.meta.url),
);
const destinationRoot = fileURLToPath(
  new URL("../public/vditor/", import.meta.url),
);
const destination = fileURLToPath(
  new URL("../public/vditor/dist/", import.meta.url),
);

if (!existsSync(source)) {
  throw new Error(
    "Vditor resources are missing. Run npm ci --prefix app first.",
  );
}

rmSync(destinationRoot, { recursive: true, force: true });
mkdirSync(destinationRoot, { recursive: true });

const copyRuntimeResource = (relativePath) => {
  const sourcePath = join(source, relativePath);
  const destinationPath = join(destination, relativePath);
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Required Vditor runtime resource is missing: ${relativePath}`,
    );
  }
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true });
};

// Vditor ships source maps, declarations, every locale, every highlight theme,
// and two math engines. lw.MD has a fixed locale/theme set and uses KaTeX, so
// package only the resources that can be requested by the current editor.
[
  "css/content-theme/dark.css",
  "css/content-theme/light.css",
  "js/i18n/zh_CN.js",
  "js/icons/material.js",
  "js/lute/lute.min.js",
  "js/highlight.js/highlight.min.js",
  "js/highlight.js/third-languages.js",
  "js/highlight.js/styles/github.min.css",
  "js/highlight.js/styles/github-dark.min.css",
  "js/abcjs",
  "js/echarts",
  "js/flowchart.js",
  "js/graphviz",
  "js/katex",
  "js/markmap",
  "js/mermaid",
  "js/plantuml",
  "js/smiles-drawer",
  "js/wavedrom",
].forEach(copyRuntimeResource);

const license = `${packageRoot}LICENSE`;
if (existsSync(license)) cpSync(license, `${destinationRoot}LICENSE`);
