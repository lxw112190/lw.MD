import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import runtime from "../vditor-runtime.config.json" with { type: "json" };

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

// Locale, icon, and theme resources are derived from the same semantic config
// consumed by MarkdownEditor. Each optional runtime group documents the feature
// that needs it, so enabling or removing a renderer has one reviewable source.
const mathResources = {
  KaTeX: ["js/katex"],
  MathJax: ["js/mathjax"],
};
const configuredMathResources = mathResources[runtime.math.engine];
if (!configuredMathResources) {
  throw new Error(`Unsupported Vditor math engine: ${runtime.math.engine}`);
}

const configuredResources = [
  `js/i18n/${runtime.locale}.js`,
  `js/icons/${runtime.icon}.js`,
  ...Object.values(runtime.themes).flatMap((theme) => [
    `css/content-theme/${theme.content}.css`,
    `js/highlight.js/styles/${theme.code}.min.css`,
  ]),
  ...configuredMathResources,
  ...runtime.resourceGroups.flatMap(({ paths }) => paths),
];

new Set(configuredResources).forEach(copyRuntimeResource);

const license = `${packageRoot}LICENSE`;
if (existsSync(license)) cpSync(license, `${destinationRoot}LICENSE`);
