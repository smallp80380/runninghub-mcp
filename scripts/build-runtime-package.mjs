import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDist = join(root, "dist");
const packageRoot = join(root, "rhcomfy-mcp");
const packageDist = join(packageRoot, "dist");
const sourceCatalog = join(root, "data", "upstream");
const packageCatalog = join(packageRoot, "data", "upstream");
const sourceLicense = join(root, "third_party", "upstream", "LICENSE");
const packageLicense = join(packageRoot, "third_party", "upstream", "LICENSE");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npmCommand, ["run", "build"], {
  cwd: root,
  stdio: "inherit",
  ...(process.platform === "win32" ? { shell: true } : {}),
});

if (!existsSync(sourceDist)) throw new Error("The root build did not create dist/.");

function copyJavaScriptTree(source, target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  let count = 0;
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const sourcePath = join(current, entry.name);
      const relativePath = relative(source, sourcePath);
      const targetPath = join(target, relativePath);
      if (entry.isDirectory()) {
        visit(sourcePath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        mkdirSync(dirname(targetPath), { recursive: true });
        cpSync(sourcePath, targetPath);
        count += 1;
      }
    }
  }
  visit(source);
  return count;
}

function copyFlatDirectory(source, target) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  let count = 0;
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    cpSync(join(source, entry.name), join(target, entry.name));
    count += 1;
  }
  return count;
}

const javascriptCount = copyJavaScriptTree(sourceDist, packageDist);
const catalogCount = copyFlatDirectory(sourceCatalog, packageCatalog);
mkdirSync(dirname(packageLicense), { recursive: true });
cpSync(sourceLicense, packageLicense);

const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const runtimeManifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
if (rootManifest.version !== runtimeManifest.version) {
  throw new Error(`Runtime package version ${runtimeManifest.version} does not match root version ${rootManifest.version}.`);
}
for (const dependency of Object.keys(rootManifest.dependencies ?? {})) {
  if (runtimeManifest.dependencies?.[dependency] !== rootManifest.dependencies[dependency]) {
    throw new Error(`Runtime dependency ${dependency} is not synchronized with the root package.`);
  }
}

console.log(`Runtime package synchronized: ${javascriptCount} JavaScript files, ${catalogCount} catalog files.`);
console.log("Excluded from the runtime package: TypeScript sources, declarations, source maps, tests, fixtures, node_modules, and local state.");
console.log(`Create the transfer archive with: powershell -NoProfile -ExecutionPolicy Bypass -File ${join(packageRoot, "package.ps1")}`);
