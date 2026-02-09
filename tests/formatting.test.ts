import { describe, it, expect } from "vitest";
import {
  formatSyncResult,
  formatStatus,
  formatSearchResults,
  formatExamplesList,
  formatExampleContent,
  formatFileContent,
  formatLibrariesList,
} from "../src/formatting.js";

describe("formatSyncResult()", () => {
  it("shows checkmark on success", () => {
    const result = formatSyncResult({
      success: true,
      version: "v1.0.0",
      message: "Successfully synced 2 repositories to /tmp/repos",
      repos: [
        { name: "noir", status: "Cloned noir @ v1.0.0 (tag)" },
        { name: "noir-examples", status: "Updated noir-examples" },
      ],
    });

    expect(result).toContain("✓ Sync completed");
    expect(result).toContain("Version: v1.0.0");
    expect(result).toContain("✓ noir:");
    expect(result).toContain("✓ noir-examples:");
  });

  it("shows warning on errors", () => {
    const result = formatSyncResult({
      success: false,
      version: "v1.0.0",
      message: "Some repositories failed to sync",
      repos: [
        { name: "noir", status: "Cloned noir @ v1.0.0 (tag)" },
        { name: "noir-examples", status: "Error: network failure" },
      ],
    });

    expect(result).toContain("⚠ Sync completed with errors");
    expect(result).toContain("✓ noir:");
    expect(result).toContain("✗ noir-examples:");
  });

  it("handles empty repos list", () => {
    const result = formatSyncResult({
      success: true,
      version: "v1.0.0",
      message: "No repos matched",
      repos: [],
    });

    expect(result).toContain("Repositories:");
    expect(result).not.toContain("✓ noir");
  });
});

describe("formatStatus()", () => {
  it("groups repos by category", () => {
    const result = formatStatus({
      reposDir: "/tmp/repos",
      repos: [
        {
          name: "noir",
          description: "Noir compiler",
          category: "core",
          cloned: true,
          commit: "abc1234",
        },
        {
          name: "noir-bignum",
          description: "Big integers",
          category: "libraries",
          cloned: false,
        },
      ],
    });

    expect(result).toContain("[core]");
    expect(result).toContain("[libraries]");
    expect(result).toContain("✓ noir (abc1234)");
    expect(result).toContain("○ noir-bignum");
  });

  it("shows hint when no repos are cloned", () => {
    const result = formatStatus({
      reposDir: "/tmp/repos",
      repos: [
        {
          name: "noir",
          description: "Noir compiler",
          category: "core",
          cloned: false,
        },
      ],
    });

    expect(result).toContain(
      "No repositories cloned. Run noir_sync_repos to get started."
    );
  });

  it("does not show hint when some repos are cloned", () => {
    const result = formatStatus({
      reposDir: "/tmp/repos",
      repos: [
        {
          name: "noir",
          description: "Noir compiler",
          category: "core",
          cloned: true,
          commit: "abc",
        },
      ],
    });

    expect(result).not.toContain("No repositories cloned");
  });
});

describe("formatSearchResults()", () => {
  it("formats results with code blocks", () => {
    const result = formatSearchResults({
      success: true,
      results: [
        { file: "noir/src/main.nr", line: 10, content: "fn main() {}", repo: "noir" },
      ],
      message: "Found 1 matches",
    });

    expect(result).toContain("**noir/src/main.nr:10**");
    expect(result).toContain("```");
    expect(result).toContain("fn main() {}");
  });

  it("handles empty results", () => {
    const result = formatSearchResults({
      success: true,
      results: [],
      message: "No matches found",
    });

    expect(result).toContain("No matches found");
    expect(result).not.toContain("```");
  });

  it("handles failure state", () => {
    const result = formatSearchResults({
      success: false,
      results: [],
      message: "No repositories are cloned.",
    });

    expect(result).toContain("No repositories are cloned.");
  });
});

describe("formatExamplesList()", () => {
  it("groups examples by repo", () => {
    const result = formatExamplesList({
      success: true,
      examples: [
        { path: "noir/examples/hello_world/src/main.nr", name: "hello_world", repo: "noir", type: "circuit" },
        { path: "noir-examples/simple_circuit/src/main.nr", name: "simple_circuit", repo: "noir-examples", type: "circuit" },
      ],
      message: "Found 2 example circuits",
    });

    expect(result).toContain("**noir:**");
    expect(result).toContain("  - hello_world");
    expect(result).toContain("**noir-examples:**");
    expect(result).toContain("  - simple_circuit");
  });

  it("handles empty examples", () => {
    const result = formatExamplesList({
      success: true,
      examples: [],
      message: "No examples found",
    });

    expect(result).toContain("No examples found");
  });

  it("handles failure state", () => {
    const result = formatExamplesList({
      success: false,
      examples: [],
      message: "No repositories are cloned.",
    });

    expect(result).toContain("No repositories are cloned.");
  });
});

describe("formatExampleContent()", () => {
  it("wraps content in noir code block", () => {
    const result = formatExampleContent({
      success: true,
      example: {
        name: "hello_world",
        path: "noir/examples/hello_world/src/main.nr",
        repo: "noir",
        type: "circuit",
      },
      content: 'fn main(x: Field) {\n    assert(x == 1);\n}',
      message: "Read hello_world from noir",
    });

    expect(result).toContain("**hello_world** (noir)");
    expect(result).toContain("```noir");
    expect(result).toContain("fn main(x: Field)");
    expect(result).toContain("```");
  });

  it("returns message on failure", () => {
    const result = formatExampleContent({
      success: false,
      message: "Example 'missing' not found.",
    });

    expect(result).toBe("Example 'missing' not found.");
  });
});

describe("formatFileContent()", () => {
  it("returns raw content on success", () => {
    const result = formatFileContent({
      success: true,
      content: "file contents here",
      message: "Read file: some/path.nr",
    });

    expect(result).toBe("file contents here");
  });

  it("returns message on failure", () => {
    const result = formatFileContent({
      success: false,
      message: "File not found: bad/path.nr",
    });

    expect(result).toBe("File not found: bad/path.nr");
  });
});

describe("formatLibrariesList()", () => {
  it("groups by category with clone status", () => {
    const result = formatLibrariesList({
      success: true,
      libraries: [
        {
          name: "noir-bignum",
          description: "Big integer arithmetic",
          category: "libraries",
          url: "https://github.com/noir-lang/noir-bignum",
          cloned: true,
        },
        {
          name: "awesome-noir",
          description: "Curated ecosystem index",
          category: "reference",
          url: "https://github.com/noir-lang/awesome-noir",
          cloned: false,
        },
      ],
      message: "Found 2 library/reference repos",
    });

    expect(result).toContain("**libraries:**");
    expect(result).toContain("**noir-bignum** [✓ cloned]");
    expect(result).toContain("**reference:**");
    expect(result).toContain("**awesome-noir** [○ not cloned]");
    expect(result).toContain(
      "Use noir_sync_repos with repos or categories to clone specific libraries."
    );
  });

  it("handles empty libraries", () => {
    const result = formatLibrariesList({
      success: true,
      libraries: [],
      message: "Found 0 library/reference repos",
    });

    expect(result).toContain("Found 0 library/reference repos");
    expect(result).not.toContain("**libraries:**");
  });
});
