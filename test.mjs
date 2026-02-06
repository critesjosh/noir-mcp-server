#!/usr/bin/env node
/**
 * Simple test script for Noir MCP Server functionality
 */

import { syncRepos, getStatus } from "./dist/tools/index.js";
import { searchCode, listExamples, listLibraries } from "./dist/utils/search.js";
import { REPOS_DIR } from "./dist/utils/git.js";

async function test() {
  console.log("=== Noir MCP Server Test ===\n");
  console.log(`Repos directory: ${REPOS_DIR}\n`);

  // Test 1: Check status before sync
  console.log("1. Checking initial status...");
  const initialStatus = await getStatus();
  console.log(`   Repos configured: ${initialStatus.repos.length}`);
  for (const repo of initialStatus.repos) {
    console.log(`   - ${repo.name} [${repo.category}]: ${repo.cloned ? "cloned" : "not cloned"}`);
  }
  console.log();

  // Test 2: List libraries (no sync needed)
  console.log("2. Listing available libraries...");
  const libs = listLibraries();
  console.log(`   Found ${libs.length} library/reference repos`);
  for (const lib of libs) {
    console.log(`   - ${lib.name} [${lib.category}]: ${lib.cloned ? "cloned" : "not cloned"}`);
  }
  console.log();

  // Test 3: Sync core repos
  console.log("3. Syncing core repositories (this may take a few minutes)...");
  const syncResult = await syncRepos({});
  console.log(`   Success: ${syncResult.success}`);
  console.log(`   Version: ${syncResult.version}`);
  for (const repo of syncResult.repos) {
    console.log(`   - ${repo.name}: ${repo.status}`);
  }
  console.log();

  // Test 4: Check status after sync
  console.log("4. Checking status after sync...");
  const afterStatus = await getStatus();
  for (const repo of afterStatus.repos) {
    const commit = repo.commit ? ` (${repo.commit})` : "";
    console.log(`   - ${repo.name}: ${repo.cloned ? "cloned" : "not cloned"}${commit}`);
  }
  console.log();

  // Test 5: Search for code
  console.log("5. Searching for 'Field' in .nr files...");
  const codeResults = searchCode("Field", { filePattern: "*.nr", maxResults: 5 });
  console.log(`   Found ${codeResults.length} results`);
  for (const result of codeResults.slice(0, 3)) {
    console.log(`   - ${result.file}:${result.line}`);
  }
  console.log();

  // Test 6: List examples
  console.log("6. Listing example circuits...");
  const examples = listExamples();
  console.log(`   Found ${examples.length} examples`);
  for (const example of examples.slice(0, 5)) {
    console.log(`   - ${example.name} (${example.repo})`);
  }
  console.log();

  console.log("=== Tests Complete ===");
}

test().catch(console.error);
