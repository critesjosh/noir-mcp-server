/**
 * Tool registry - exports all MCP tools
 */

export { syncRepos, getStatus } from "./sync.js";
export {
  searchNoirCode,
  searchNoirDocs,
  searchNoirStdlib,
  listNoirExamples,
  readNoirExample,
  readRepoFile,
  listNoirLibraries,
} from "./search.js";
