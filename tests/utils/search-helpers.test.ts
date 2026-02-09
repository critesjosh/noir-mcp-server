import { describe, it, expect, vi } from "vitest";
import { join } from "path";

// We need to mock REPOS_DIR before importing the module under test,
// because parseRgOutput uses REPOS_DIR via `relative()`.
const MOCK_REPOS_DIR = "/mock/repos";

vi.mock("../../src/utils/git.js", () => ({
  REPOS_DIR: MOCK_REPOS_DIR,
  getRepoPath: (name: string) => join(MOCK_REPOS_DIR, name),
  isRepoCloned: () => false,
}));

// Must import after mocks are set up
const { escapeShell, parseRgOutput, getFileType } = await import(
  "../../src/utils/search.js"
);

describe("escapeShell()", () => {
  it("passes through simple strings", () => {
    expect(escapeShell("hello")).toBe("hello");
    expect(escapeShell("fn main")).toBe("fn main");
  });

  it("escapes double quotes", () => {
    expect(escapeShell('say "hi"')).toBe('say \\"hi\\"');
  });

  it("escapes dollar signs", () => {
    expect(escapeShell("$HOME")).toBe("\\$HOME");
  });

  it("escapes backticks", () => {
    expect(escapeShell("`whoami`")).toBe("\\`whoami\\`");
  });

  it("escapes backslashes", () => {
    expect(escapeShell("a\\b")).toBe("a\\\\b");
  });

  it("escapes exclamation marks", () => {
    expect(escapeShell("hello!")).toBe("hello\\!");
  });

  it("preserves regex characters", () => {
    expect(escapeShell("foo|bar")).toBe("foo|bar");
    expect(escapeShell("a*b+c?")).toBe("a*b+c?");
    expect(escapeShell("(group)")).toBe("(group)");
    expect(escapeShell("[abc]")).toBe("[abc]");
    expect(escapeShell("a{2,3}")).toBe("a{2,3}");
    expect(escapeShell("^start$end")).toContain("^start");
    // $ gets escaped, which is correct for shell safety
    expect(escapeShell("^start$end")).toBe("^start\\$end");
  });

  it("handles shell injection attempts", () => {
    // The " is escaped with a backslash, preventing shell interpretation
    const result1 = escapeShell('"; rm -rf /');
    expect(result1).toBe('\\"; rm -rf /');
    expect(result1.startsWith('\\"')).toBe(true);

    const result2 = escapeShell("`whoami`");
    expect(result2).toBe("\\`whoami\\`");

    const result3 = escapeShell("$(whoami)");
    expect(result3).toBe("\\$(whoami)");
  });
});

describe("parseRgOutput()", () => {
  it("parses standard file:line:content format", () => {
    const output = `${MOCK_REPOS_DIR}/noir/src/main.nr:42:fn main() {}\n`;
    const results = parseRgOutput(output, 10);

    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("noir/src/main.nr");
    expect(results[0].line).toBe(42);
    expect(results[0].content).toBe("fn main() {}");
    expect(results[0].repo).toBe("noir");
  });

  it("respects maxResults limit", () => {
    const lines = Array.from(
      { length: 10 },
      (_, i) => `${MOCK_REPOS_DIR}/noir/file${i}.nr:${i + 1}:line ${i}`
    ).join("\n");

    const results = parseRgOutput(lines, 3);
    expect(results).toHaveLength(3);
  });

  it("skips blank lines", () => {
    const output = `${MOCK_REPOS_DIR}/noir/a.nr:1:hello\n\n\n${MOCK_REPOS_DIR}/noir/b.nr:2:world\n`;
    const results = parseRgOutput(output, 10);
    expect(results).toHaveLength(2);
  });

  it("skips malformed lines", () => {
    const output = [
      `${MOCK_REPOS_DIR}/noir/good.nr:1:valid line`,
      "this is not a valid rg line",
      `${MOCK_REPOS_DIR}/noir/also-good.nr:2:another valid`,
    ].join("\n");

    const results = parseRgOutput(output, 10);
    expect(results).toHaveLength(2);
  });

  it("handles content containing colons", () => {
    const output = `${MOCK_REPOS_DIR}/noir/test.nr:5:let x: Field = 42;\n`;
    const results = parseRgOutput(output, 10);

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("let x: Field = 42;");
  });

  it("extracts relative paths and repo names", () => {
    const output = `${MOCK_REPOS_DIR}/noir-bignum/src/lib.nr:10:use dep;\n`;
    const results = parseRgOutput(output, 10);

    expect(results[0].file).toBe("noir-bignum/src/lib.nr");
    expect(results[0].repo).toBe("noir-bignum");
  });

  it("returns empty array for empty input", () => {
    expect(parseRgOutput("", 10)).toEqual([]);
  });
});

describe("getFileType()", () => {
  it('returns "circuit" for .nr files', () => {
    expect(getFileType("src/main.nr")).toBe("circuit");
  });

  it('returns "test" for .nr files with "test" in path', () => {
    expect(getFileType("test/my_test.nr")).toBe("test");
    expect(getFileType("src/tests/check.nr")).toBe("test");
  });

  it('returns "typescript" for .ts and .tsx files', () => {
    expect(getFileType("index.ts")).toBe("typescript");
    expect(getFileType("component.tsx")).toBe("typescript");
  });

  it('returns "docs" for .md and .mdx files', () => {
    expect(getFileType("README.md")).toBe("docs");
    expect(getFileType("guide.mdx")).toBe("docs");
  });

  it('returns "other" for everything else', () => {
    expect(getFileType("Cargo.toml")).toBe("other");
    expect(getFileType("main.rs")).toBe("other");
    expect(getFileType("package.json")).toBe("other");
  });
});
