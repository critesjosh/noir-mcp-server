#!/usr/bin/env node

/**
 * Syncs DEFAULT_BB_VERSION in src/repos/config.ts to match DEFAULT_NOIR_VERSION
 * using the bb-versions.json mapping from aztec-packages.
 */

import { readFileSync, writeFileSync } from "fs";

const CONFIG_PATH = "src/repos/config.ts";
const BB_VERSIONS_URL =
  "https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/bb-versions.json";

// 1. Read config.ts and extract DEFAULT_NOIR_VERSION
const config = readFileSync(CONFIG_PATH, "utf-8");

const noirMatch = config.match(
  /DEFAULT_NOIR_VERSION\s*=\s*process\.env\.\w+\s*\|\|\s*"([^"]+)"/
);
if (!noirMatch) {
  console.error("Could not find DEFAULT_NOIR_VERSION in config.ts");
  process.exit(1);
}
const noirVersion = noirMatch[1];
console.log(`Current DEFAULT_NOIR_VERSION: ${noirVersion}`);

// 2. Strip leading "v" — the JSON keys have no prefix
const noirKey = noirVersion.replace(/^v/, "");

// 3. Fetch bb-versions.json
console.log(`Fetching bb-versions.json...`);
const res = await fetch(BB_VERSIONS_URL);
if (!res.ok) {
  console.error(`Failed to fetch bb-versions.json: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const bbVersions = await res.json();

// 4. Look up the corresponding bb version
const bbVersion = bbVersions[noirKey];
if (!bbVersion) {
  console.error(
    `No bb version found for Noir "${noirKey}". Available keys:\n  ${Object.keys(bbVersions).slice(-10).join("\n  ")}`
  );
  process.exit(1);
}
console.log(`Mapped Noir ${noirKey} -> bb ${bbVersion}`);

// 5. Update DEFAULT_BB_VERSION in config.ts (add "v" prefix to match convention)
const newBBVersion = `v${bbVersion}`;
const bbMatch = config.match(
  /DEFAULT_BB_VERSION\s*=\s*process\.env\.\w+\s*\|\|\s*"([^"]+)"/
);
if (!bbMatch) {
  console.error("Could not find DEFAULT_BB_VERSION in config.ts");
  process.exit(1);
}
const oldBBVersion = bbMatch[0];
const newBBLine = oldBBVersion.replace(bbMatch[1], newBBVersion);

if (bbMatch[1] === newBBVersion) {
  console.log(`DEFAULT_BB_VERSION is already ${newBBVersion} — no changes needed.`);
  process.exit(0);
}

const updated = config.replace(oldBBVersion, newBBLine);
writeFileSync(CONFIG_PATH, updated);
console.log(`Updated DEFAULT_BB_VERSION: "${bbMatch[1]}" -> "${newBBVersion}"`);
