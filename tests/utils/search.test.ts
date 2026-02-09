import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "path";

const MOCK_REPOS_DIR = "/mock/repos";

// Mock git utilities
vi.mock("../../src/utils/git.js", () => ({
  REPOS_DIR: MOCK_REPOS_DIR,
  getRepoPath: (name: string) => join(MOCK_REPOS_DIR, name),
  isRepoCloned: vi.fn(() => true),
}));

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => "line1\nline2\nline3"),
}));

// Mock globby
vi.mock("globby", () => ({
  globbySync: vi.fn(() => []),
}));

// Mock config
vi.mock("../../src/repos/config.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
  };
});

const { execSync } = await import("child_process");
const { existsSync, readFileSync } = await import("fs");
const { globbySync } = await import("globby");
const { isRepoCloned } = await import("../../src/utils/git.js");

const {
  searchCode,
  searchDocs,
  searchStdlib,
  listExamples,
  findExample,
  readFile,
  listLibraries,
  manualSearch,
} = await import("../../src/utils/search.js");

const mockedExecSync = vi.mocked(execSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedGlobbySync = vi.mocked(globbySync);
const mockedIsRepoCloned = vi.mocked(isRepoCloned);

describe("utils/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedIsRepoCloned.mockReturnValue(true);
  });

  describe("searchCode()", () => {
    it("constructs ripgrep command with proper flags", () => {
      mockedExecSync.mockReturnValue(
        `${MOCK_REPOS_DIR}/noir/src/main.nr:1:fn main() {}\n`
      );

      searchCode("fn main", { filePattern: "*.nr", maxResults: 10 });

      const call = mockedExecSync.mock.calls[0];
      const cmd = call[0] as string;
      expect(cmd).toContain("rg");
      expect(cmd).toContain("-i"); // case insensitive by default
      expect(cmd).toContain("-n");
      expect(cmd).toContain("-g");
      expect(cmd).toContain("*.nr");
      expect(cmd).toContain("fn main");
    });

    it("omits -i flag when caseSensitive is true", () => {
      mockedExecSync.mockReturnValue("");

      searchCode("Test", { caseSensitive: true });

      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).not.toMatch(/\s-i\s/);
    });

    it("searches specific repo when provided", () => {
      mockedExecSync.mockReturnValue("");

      searchCode("query", { repo: "noir-bignum" });

      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain(join(MOCK_REPOS_DIR, "noir-bignum"));
    });

    it("returns empty array when search path does not exist", () => {
      mockedExistsSync.mockReturnValue(false);

      const results = searchCode("test");
      expect(results).toEqual([]);
    });

    it("falls back to manualSearch when rg fails", () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error("rg not found");
      });
      mockedGlobbySync.mockReturnValue([]);

      const results = searchCode("test");
      expect(results).toEqual([]);
      // Verify globby was called (manualSearch uses it)
      expect(mockedGlobbySync).toHaveBeenCalled();
    });
  });

  describe("searchDocs()", () => {
    it("uses md/mdx file pattern", () => {
      mockedExecSync.mockReturnValue("");

      searchDocs("getting started");

      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain("*.{md,mdx}");
    });

    it("handles section path", () => {
      // When section exists, it searches within that subdirectory
      mockedExistsSync.mockReturnValue(true);
      mockedExecSync.mockReturnValue("");

      searchDocs("install", { section: "tutorials" });

      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain("noir/docs/tutorials");
    });
  });

  describe("searchStdlib()", () => {
    it("searches within noir/noir_stdlib", () => {
      mockedExecSync.mockReturnValue("");

      searchStdlib("hash");

      const cmd = mockedExecSync.mock.calls[0][0] as string;
      expect(cmd).toContain("noir/noir_stdlib");
    });

    it("returns empty when stdlib path does not exist", () => {
      mockedExistsSync.mockReturnValue(false);

      const results = searchStdlib("hash");
      expect(results).toEqual([]);
    });
  });

  describe("manualSearch()", () => {
    it("uses globby to find files and regex to match", () => {
      mockedGlobbySync.mockReturnValue([
        join(MOCK_REPOS_DIR, "noir/src/test.nr"),
      ]);
      mockedReadFileSync.mockReturnValue("line one\nmatch here\nline three");

      const results = manualSearch(
        "match",
        MOCK_REPOS_DIR,
        "*.nr",
        10,
        false
      );

      expect(results.length).toBe(1);
      expect(results[0].content).toBe("match here");
      expect(results[0].line).toBe(2);
    });

    it("respects maxResults", () => {
      mockedGlobbySync.mockReturnValue([
        join(MOCK_REPOS_DIR, "noir/src/a.nr"),
      ]);
      mockedReadFileSync.mockReturnValue("match\nmatch\nmatch\nmatch\nmatch");

      const results = manualSearch(
        "match",
        MOCK_REPOS_DIR,
        "*.nr",
        2,
        false
      );

      expect(results.length).toBe(2);
    });

    it("falls back to escaped regex on invalid pattern", () => {
      mockedGlobbySync.mockReturnValue([
        join(MOCK_REPOS_DIR, "noir/src/a.nr"),
      ]);
      mockedReadFileSync.mockReturnValue("test [invalid regex");

      // Invalid regex like "[invalid" should not throw
      const results = manualSearch(
        "[invalid",
        MOCK_REPOS_DIR,
        "*.nr",
        10,
        false
      );

      expect(results.length).toBe(1);
    });
  });

  describe("listExamples()", () => {
    it("combines examples from noir-examples and noir/examples", () => {
      mockedExistsSync.mockReturnValue(true);

      // findCircuits uses globbySync
      mockedGlobbySync
        .mockReturnValueOnce([
          join(MOCK_REPOS_DIR, "noir-examples/simple_circuit/src/main.nr"),
        ])
        .mockReturnValueOnce([
          join(MOCK_REPOS_DIR, "noir/examples/hello_world/src/main.nr"),
        ]);

      const examples = listExamples();

      expect(examples.length).toBe(2);
      expect(examples[0].repo).toBe("noir-examples");
      expect(examples[1].repo).toBe("noir");
    });

    it("filters by category", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedGlobbySync
        .mockReturnValueOnce([
          join(MOCK_REPOS_DIR, "noir-examples/hash_example/src/main.nr"),
        ])
        .mockReturnValueOnce([
          join(MOCK_REPOS_DIR, "noir/examples/hello_world/src/main.nr"),
        ]);

      const examples = listExamples("hash");
      expect(examples.length).toBe(1);
      expect(examples[0].name).toBe("hash_example");
    });
  });

  describe("findExample()", () => {
    it("finds exact match by name", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedGlobbySync
        .mockReturnValueOnce([
          join(MOCK_REPOS_DIR, "noir-examples/hello_world/src/main.nr"),
        ])
        .mockReturnValueOnce([]);

      const example = findExample("hello_world");
      expect(example?.name).toBe("hello_world");
    });

    it("finds partial match", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedGlobbySync
        .mockReturnValueOnce([
          join(MOCK_REPOS_DIR, "noir-examples/merkle_proof/src/main.nr"),
        ])
        .mockReturnValueOnce([]);

      const example = findExample("merkle");
      expect(example?.name).toBe("merkle_proof");
    });

    it("returns null when not found", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedGlobbySync.mockReturnValue([]);

      const example = findExample("nonexistent");
      expect(example).toBeNull();
    });
  });

  describe("readFile()", () => {
    it("reads relative path from REPOS_DIR", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("file content");

      const content = readFile("noir/src/main.nr");
      expect(content).toBe("file content");
      expect(mockedReadFileSync).toHaveBeenCalledWith(
        join(MOCK_REPOS_DIR, "noir/src/main.nr"),
        "utf-8"
      );
    });

    it("reads absolute path directly", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue("abs content");

      const content = readFile("/absolute/path/file.nr");
      expect(content).toBe("abs content");
      expect(mockedReadFileSync).toHaveBeenCalledWith(
        "/absolute/path/file.nr",
        "utf-8"
      );
    });

    it("returns null when file does not exist", () => {
      mockedExistsSync.mockReturnValue(false);

      const content = readFile("nonexistent.nr");
      expect(content).toBeNull();
    });

    it("returns null on read error", () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockImplementation(() => {
        throw new Error("read error");
      });

      const content = readFile("bad-file.nr");
      expect(content).toBeNull();
    });
  });

  describe("listLibraries()", () => {
    it("returns libraries and reference repos by default", () => {
      const libs = listLibraries();
      expect(libs.length).toBeGreaterThan(0);
      for (const lib of libs) {
        expect(["libraries", "reference"]).toContain(lib.category);
      }
    });

    it("filters by category", () => {
      const libs = listLibraries("libraries");
      for (const lib of libs) {
        expect(lib.category).toBe("libraries");
      }
    });

    it("includes clone status", () => {
      mockedIsRepoCloned.mockReturnValue(false);
      const libs = listLibraries();
      for (const lib of libs) {
        expect(lib.cloned).toBe(false);
      }
    });
  });
});
