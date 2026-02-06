/**
 * Search tools for finding content in Noir repositories
 */

import {
  searchCode as doSearchCode,
  searchDocs as doSearchDocs,
  searchStdlib as doSearchStdlib,
  listExamples as doListExamples,
  listLibraries as doListLibraries,
  findExample,
  readFile,
  SearchResult,
  FileInfo,
  LibraryInfo,
} from "../utils/search.js";
import { isRepoCloned } from "../utils/git.js";
import { getRepoNames, RepoCategory } from "../repos/config.js";

/**
 * Search Noir code (.nr files, TypeScript, etc.)
 */
export function searchNoirCode(options: {
  query: string;
  filePattern?: string;
  repo?: string;
  maxResults?: number;
}): {
  success: boolean;
  results: SearchResult[];
  message: string;
} {
  const { query, filePattern = "*.nr", repo, maxResults = 30 } = options;

  if (repo && !isRepoCloned(repo)) {
    return {
      success: false,
      results: [],
      message: `Repository '${repo}' is not cloned. Run noir_sync_repos first.`,
    };
  }

  const anyCloned = getRepoNames().some(isRepoCloned);
  if (!anyCloned) {
    return {
      success: false,
      results: [],
      message: "No repositories are cloned. Run noir_sync_repos first.",
    };
  }

  const results = doSearchCode(query, { filePattern, repo, maxResults });

  return {
    success: true,
    results,
    message:
      results.length > 0
        ? `Found ${results.length} matches`
        : "No matches found",
  };
}

/**
 * Search Noir documentation
 */
export function searchNoirDocs(options: {
  query: string;
  section?: string;
  maxResults?: number;
}): {
  success: boolean;
  results: SearchResult[];
  message: string;
} {
  const { query, section, maxResults = 20 } = options;

  if (!isRepoCloned("noir")) {
    return {
      success: false,
      results: [],
      message:
        "noir repo is not cloned. Run noir_sync_repos first to get documentation.",
    };
  }

  const results = doSearchDocs(query, { section, maxResults });

  return {
    success: true,
    results,
    message:
      results.length > 0
        ? `Found ${results.length} documentation matches`
        : "No documentation matches found",
  };
}

/**
 * Search Noir standard library
 */
export function searchNoirStdlib(options: {
  query: string;
  maxResults?: number;
}): {
  success: boolean;
  results: SearchResult[];
  message: string;
} {
  const { query, maxResults = 30 } = options;

  if (!isRepoCloned("noir")) {
    return {
      success: false,
      results: [],
      message:
        "noir repo is not cloned. Run noir_sync_repos first to search the standard library.",
    };
  }

  const results = doSearchStdlib(query, { maxResults });

  return {
    success: true,
    results,
    message:
      results.length > 0
        ? `Found ${results.length} stdlib matches`
        : "No stdlib matches found",
  };
}

/**
 * List available Noir example circuits
 */
export function listNoirExamples(options: { category?: string }): {
  success: boolean;
  examples: FileInfo[];
  message: string;
} {
  const { category } = options;

  const anyCloned = getRepoNames().some(isRepoCloned);
  if (!anyCloned) {
    return {
      success: false,
      examples: [],
      message: "No repositories are cloned. Run noir_sync_repos first.",
    };
  }

  const examples = doListExamples(category);

  return {
    success: true,
    examples,
    message:
      examples.length > 0
        ? `Found ${examples.length} example circuits`
        : category
          ? `No examples found matching category '${category}'`
          : "No examples found",
  };
}

/**
 * Read an example circuit
 */
export function readNoirExample(options: { name: string }): {
  success: boolean;
  example?: FileInfo;
  content?: string;
  message: string;
} {
  const { name } = options;

  const example = findExample(name);

  if (!example) {
    return {
      success: false,
      message: `Example '${name}' not found. Use noir_list_examples to see available examples.`,
    };
  }

  const content = readFile(example.path);

  if (!content) {
    return {
      success: false,
      example,
      message: `Could not read example file: ${example.path}`,
    };
  }

  return {
    success: true,
    example,
    content,
    message: `Read ${example.name} from ${example.repo}`,
  };
}

/**
 * Read any file from cloned repos
 */
export function readRepoFile(options: { path: string }): {
  success: boolean;
  content?: string;
  message: string;
} {
  const { path } = options;

  const content = readFile(path);

  if (!content) {
    return {
      success: false,
      message: `File not found: ${path}. Make sure the path is relative to the repos directory.`,
    };
  }

  return {
    success: true,
    content,
    message: `Read file: ${path}`,
  };
}

/**
 * List Noir libraries with descriptions and clone status
 */
export function listNoirLibraries(options: { category?: string }): {
  success: boolean;
  libraries: LibraryInfo[];
  message: string;
} {
  const validCategories: RepoCategory[] = ["libraries", "reference"];
  const category =
    options.category && validCategories.includes(options.category as RepoCategory)
      ? (options.category as RepoCategory)
      : undefined;

  const libraries = doListLibraries(category);

  return {
    success: true,
    libraries,
    message: `Found ${libraries.length} library/reference repos`,
  };
}
