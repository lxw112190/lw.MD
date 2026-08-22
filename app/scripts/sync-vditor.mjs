import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
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
cpSync(source, destination, { recursive: true });

const license = `${packageRoot}LICENSE`;
if (existsSync(license)) cpSync(license, `${destinationRoot}LICENSE`);
