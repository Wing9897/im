/**
 * Propagate repo-root VERSION to npm/pyproject manifests and workspace lock entries.
 * Usage: node scripts/sync-version.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const version = readFileSync(path.join(root, "VERSION"), "utf8").trim();

if (!/^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/.test(version)) {
  console.error(`[sync-version] Invalid semver in VERSION: ${version}`);
  process.exit(1);
}

const packageJsonPaths = [
  path.join(root, "package.json"),
  path.join(root, "web", "package.json"),
  path.join(root, "desktop", "package.json"),
];

for (const filePath of packageJsonPaths) {
  const pkg = JSON.parse(readFileSync(filePath, "utf8"));
  pkg.version = version;
  writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`[sync-version] ${path.relative(root, filePath)} → ${version}`);
}

const pyprojectPath = path.join(root, "pyproject.toml");
const pyproject = readFileSync(pyprojectPath, "utf8");
const nextPyproject = pyproject.replace(/^version\s*=\s*".*"$/m, `version = "${version}"`);
if (nextPyproject === pyproject) {
  if (!new RegExp(`^version\\s*=\\s*"${version.replace(/\./g, "\\.")}"\\s*$`, "m").test(pyproject)) {
    console.error("[sync-version] Could not update pyproject.toml version field");
    process.exit(1);
  }
  console.log(`[sync-version] pyproject.toml already ${version}`);
} else {
  writeFileSync(pyprojectPath, nextPyproject, "utf8");
  console.log(`[sync-version] pyproject.toml → ${version}`);
}

const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
lock.version = version;
if (lock.packages?.[""]) {
  lock.packages[""].version = version;
}
for (const key of [
  "node_modules/intelligence-monitor-web",
  "node_modules/intelligence-monitor-desktop",
]) {
  if (lock.packages?.[key]) {
    lock.packages[key].version = version;
  }
}
for (const key of ["web", "desktop"]) {
  if (lock.packages?.[key]?.name?.startsWith("intelligence-monitor")) {
    lock.packages[key].version = version;
  }
}
writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
console.log(`[sync-version] package-lock.json workspace versions → ${version}`);

// uv.lock records the virtual root package in PEP 440 form (0.1.0-beta.7 → 0.1.0b7).
const pep440 = version
  .replace(/-alpha\./gi, "a")
  .replace(/-beta\./gi, "b")
  .replace(/-rc\./gi, "rc")
  .replace(/-preview\./gi, "rc");
const uvLockPath = path.join(root, "uv.lock");
const uvLock = readFileSync(uvLockPath, "utf8");
const uvPackageRe =
  /(\[\[package\]\]\r?\nname = "intelligence-monitor-server"\r?\nversion = ")([^"]+)(")/;
if (!uvPackageRe.test(uvLock)) {
  console.error("[sync-version] Could not find intelligence-monitor-server in uv.lock");
  process.exit(1);
}
const nextUvLock = uvLock.replace(uvPackageRe, `$1${pep440}$3`);
if (nextUvLock !== uvLock) {
  writeFileSync(uvLockPath, nextUvLock, "utf8");
  console.log(`[sync-version] uv.lock intelligence-monitor-server → ${pep440}`);
} else {
  console.log(`[sync-version] uv.lock already ${pep440}`);
}

// Keep committed OpenAPI info.version aligned with VERSION (export embeds FastAPI app version).
const openapiPath = path.join(root, "web", "openapi", "openapi.json");
const openapi = JSON.parse(readFileSync(openapiPath, "utf8"));
if (openapi?.info?.version !== version) {
  openapi.info.version = version;
  writeFileSync(openapiPath, `${JSON.stringify(openapi, null, 2)}\n`, "utf8");
  console.log(`[sync-version] web/openapi/openapi.json info.version → ${version}`);
} else {
  console.log(`[sync-version] web/openapi/openapi.json already ${version}`);
}
