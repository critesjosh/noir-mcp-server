#!/usr/bin/env node
/**
 * Noir MCP Server
 *
 * An MCP server that provides local access to Noir documentation,
 * standard library, examples, and library source code through cloned repositories.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import {
  syncRepos,
  getStatus,
  searchNoirCode,
  searchNoirDocs,
  searchNoirStdlib,
  listNoirExamples,
  readNoirExample,
  readRepoFile,
  listNoirLibraries,
} from "./tools/index.js";

import {
  formatSyncResult,
  formatStatus,
  formatSearchResults,
  formatExamplesList,
  formatExampleContent,
  formatFileContent,
  formatLibrariesList,
} from "./formatting.js";

const server = new Server(
  {
    name: "noir-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Define available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "noir_sync_repos",
      description:
        "Clone or update Noir repositories locally. Run this first to enable searching. " +
        "Default: syncs core repos (noir compiler/stdlib/docs, noir-examples). " +
        "Use categories to sync additional repos: 'libraries' for community packages, 'reference' for awesome-noir.",
      inputSchema: {
        type: "object",
        properties: {
          version: {
            type: "string",
            description:
              "Noir version tag for the main noir repo (e.g., 'v1.0.0-beta.3'). Defaults to latest supported version.",
          },
          force: {
            type: "boolean",
            description: "Force re-clone even if repos exist (default: false)",
          },
          repos: {
            type: "array",
            items: { type: "string" },
            description:
              "Specific repos to sync by name (e.g., ['noir-bignum', 'noir_json_parser'])",
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description:
              "Categories to sync: 'core' (default), 'libraries', 'reference'. Example: ['core', 'libraries']",
          },
        },
      },
    },
    {
      name: "noir_status",
      description:
        "Check the status of cloned Noir repositories - shows which repos are available, their categories, and commit hashes.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "noir_search_code",
      description:
        "Search Noir source code across all cloned repos. Supports regex patterns. " +
        "Use for finding function implementations, patterns, and examples in .nr files.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (supports regex)",
          },
          filePattern: {
            type: "string",
            description:
              "File glob pattern (default: *.nr). Examples: *.ts, *.{nr,rs}",
          },
          repo: {
            type: "string",
            description:
              "Specific repo to search (e.g., 'noir', 'noir-bignum', 'zk-kit.noir')",
          },
          maxResults: {
            type: "number",
            description: "Maximum results to return (default: 30)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "noir_search_docs",
      description:
        "Search Noir documentation. Use for finding language guides, tutorials, and API documentation.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Documentation search query",
          },
          section: {
            type: "string",
            description:
              "Docs section to search (subdirectory under noir/docs/)",
          },
          maxResults: {
            type: "number",
            description: "Maximum results to return (default: 20)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "noir_search_stdlib",
      description:
        "Search the Noir standard library (noir_stdlib). " +
        "Use for finding built-in functions, traits, and types available in Noir.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query (e.g., 'hash', 'Field', 'assert', 'pedersen')",
          },
          maxResults: {
            type: "number",
            description: "Maximum results to return (default: 30)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "noir_list_examples",
      description:
        "List available Noir example circuits from noir-examples and noir/examples.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Filter by category/keyword (e.g., 'hash', 'merkle', 'ecdsa')",
          },
        },
      },
    },
    {
      name: "noir_read_example",
      description:
        "Read the source code of a Noir example circuit. Use noir_list_examples to find available examples.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Example name (e.g., 'hello_world', 'merkle_proof')",
          },
        },
        required: ["name"],
      },
    },
    {
      name: "noir_read_file",
      description:
        "Read any file from the cloned repositories by path. Path should be relative to the repos directory.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "File path relative to repos directory (e.g., 'noir/noir_stdlib/src/hash/mod.nr')",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "noir_list_libraries",
      description:
        "List available Noir library and reference repos with descriptions and clone status. " +
        "Use to discover community packages and tools in the Noir ecosystem.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Filter by category: 'libraries' or 'reference'. Shows both if omitted.",
          },
        },
      },
    },
  ],
}));

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "noir_sync_repos": {
        const result = await syncRepos({
          version: args?.version as string | undefined,
          force: args?.force as boolean | undefined,
          repos: args?.repos as string[] | undefined,
          categories: args?.categories as import("./repos/config.js").RepoCategory[] | undefined,
        });
        return {
          content: [{ type: "text", text: formatSyncResult(result) }],
        };
      }

      case "noir_status": {
        const status = await getStatus();
        return {
          content: [{ type: "text", text: formatStatus(status) }],
        };
      }

      case "noir_search_code": {
        if (!args?.query) {
          throw new McpError(ErrorCode.InvalidParams, "query is required");
        }
        const result = searchNoirCode({
          query: args.query as string,
          filePattern: args?.filePattern as string | undefined,
          repo: args?.repo as string | undefined,
          maxResults: args?.maxResults as number | undefined,
        });
        return {
          content: [{ type: "text", text: formatSearchResults(result) }],
        };
      }

      case "noir_search_docs": {
        if (!args?.query) {
          throw new McpError(ErrorCode.InvalidParams, "query is required");
        }
        const result = searchNoirDocs({
          query: args.query as string,
          section: args?.section as string | undefined,
          maxResults: args?.maxResults as number | undefined,
        });
        return {
          content: [{ type: "text", text: formatSearchResults(result) }],
        };
      }

      case "noir_search_stdlib": {
        if (!args?.query) {
          throw new McpError(ErrorCode.InvalidParams, "query is required");
        }
        const result = searchNoirStdlib({
          query: args.query as string,
          maxResults: args?.maxResults as number | undefined,
        });
        return {
          content: [{ type: "text", text: formatSearchResults(result) }],
        };
      }

      case "noir_list_examples": {
        const result = listNoirExamples({
          category: args?.category as string | undefined,
        });
        return {
          content: [{ type: "text", text: formatExamplesList(result) }],
        };
      }

      case "noir_read_example": {
        if (!args?.name) {
          throw new McpError(ErrorCode.InvalidParams, "name is required");
        }
        const result = readNoirExample({
          name: args.name as string,
        });
        return {
          content: [{ type: "text", text: formatExampleContent(result) }],
        };
      }

      case "noir_read_file": {
        if (!args?.path) {
          throw new McpError(ErrorCode.InvalidParams, "path is required");
        }
        const result = readRepoFile({
          path: args.path as string,
        });
        return {
          content: [{ type: "text", text: formatFileContent(result) }],
        };
      }

      case "noir_list_libraries": {
        const result = listNoirLibraries({
          category: args?.category as string | undefined,
        });
        return {
          content: [{ type: "text", text: formatLibrariesList(result) }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;

    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Noir MCP Server started");
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
