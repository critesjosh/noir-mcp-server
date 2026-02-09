import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the utility modules
vi.mock("../../src/utils/search.js", () => ({
  searchCode: vi.fn(() => []),
  searchDocs: vi.fn(() => []),
  searchStdlib: vi.fn(() => []),
  listExamples: vi.fn(() => []),
  listLibraries: vi.fn(() => []),
  findExample: vi.fn(() => null),
  readFile: vi.fn(() => null),
}));

vi.mock("../../src/utils/git.js", () => ({
  isRepoCloned: vi.fn(() => false),
  REPOS_DIR: "/mock/repos",
  getRepoPath: vi.fn((name: string) => `/mock/repos/${name}`),
}));

vi.mock("../../src/repos/config.js", () => ({
  getRepoNames: vi.fn(() => ["noir", "noir-examples", "noir-bignum"]),
  NOIR_REPOS: [
    { name: "noir", category: "core" },
    { name: "noir-examples", category: "core" },
    { name: "noir-bignum", category: "libraries" },
  ],
}));

const { isRepoCloned } = await import("../../src/utils/git.js");
const { getRepoNames } = await import("../../src/repos/config.js");
const searchUtils = await import("../../src/utils/search.js");

const {
  searchNoirCode,
  searchNoirDocs,
  searchNoirStdlib,
  listNoirExamples,
  readNoirExample,
  readRepoFile,
  listNoirLibraries,
} = await import("../../src/tools/search.js");

const mockedIsRepoCloned = vi.mocked(isRepoCloned);
const mockedGetRepoNames = vi.mocked(getRepoNames);
const mockedSearchCode = vi.mocked(searchUtils.searchCode);
const mockedSearchDocs = vi.mocked(searchUtils.searchDocs);
const mockedSearchStdlib = vi.mocked(searchUtils.searchStdlib);
const mockedListExamples = vi.mocked(searchUtils.listExamples);
const mockedFindExample = vi.mocked(searchUtils.findExample);
const mockedReadFile = vi.mocked(searchUtils.readFile);
const mockedListLibraries = vi.mocked(searchUtils.listLibraries);

describe("tools/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetRepoNames.mockReturnValue(["noir", "noir-examples", "noir-bignum"]);
  });

  describe("searchNoirCode()", () => {
    it("returns failure when specified repo is not cloned", () => {
      mockedIsRepoCloned.mockReturnValue(false);

      const result = searchNoirCode({ query: "fn main", repo: "noir-bignum" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("not cloned");
    });

    it("returns failure when no repos are cloned at all", () => {
      mockedIsRepoCloned.mockReturnValue(false);

      const result = searchNoirCode({ query: "fn main" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("No repositories are cloned");
    });

    it("delegates to searchCode and returns results", () => {
      mockedIsRepoCloned.mockReturnValue(true);
      mockedSearchCode.mockReturnValue([
        { file: "noir/src/main.nr", line: 1, content: "fn main() {}", repo: "noir" },
      ]);

      const result = searchNoirCode({ query: "fn main" });
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.message).toContain("Found 1 matches");
    });

    it("returns success with empty results message", () => {
      mockedIsRepoCloned.mockReturnValue(true);
      mockedSearchCode.mockReturnValue([]);

      const result = searchNoirCode({ query: "nonexistent" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("No matches found");
    });
  });

  describe("searchNoirDocs()", () => {
    it("returns failure when noir repo is not cloned", () => {
      mockedIsRepoCloned.mockReturnValue(false);

      const result = searchNoirDocs({ query: "getting started" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("noir repo is not cloned");
    });

    it("delegates to searchDocs on success", () => {
      mockedIsRepoCloned.mockReturnValue(true);
      mockedSearchDocs.mockReturnValue([
        { file: "noir/docs/intro.md", line: 5, content: "Getting started", repo: "noir" },
      ]);

      const result = searchNoirDocs({ query: "getting started" });
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });
  });

  describe("searchNoirStdlib()", () => {
    it("returns failure when noir repo is not cloned", () => {
      mockedIsRepoCloned.mockReturnValue(false);

      const result = searchNoirStdlib({ query: "hash" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("noir repo is not cloned");
    });

    it("delegates to searchStdlib on success", () => {
      mockedIsRepoCloned.mockReturnValue(true);
      mockedSearchStdlib.mockReturnValue([
        { file: "noir/noir_stdlib/src/hash/mod.nr", line: 3, content: "fn hash()", repo: "noir" },
      ]);

      const result = searchNoirStdlib({ query: "hash" });
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });
  });

  describe("listNoirExamples()", () => {
    it("returns failure when no repos are cloned", () => {
      mockedIsRepoCloned.mockReturnValue(false);

      const result = listNoirExamples({});
      expect(result.success).toBe(false);
    });

    it("delegates to listExamples with category", () => {
      mockedIsRepoCloned.mockReturnValue(true);
      mockedListExamples.mockReturnValue([
        { path: "noir-examples/hash/src/main.nr", name: "hash", repo: "noir-examples", type: "circuit" },
      ]);

      const result = listNoirExamples({ category: "hash" });
      expect(result.success).toBe(true);
      expect(result.examples).toHaveLength(1);
      expect(mockedListExamples).toHaveBeenCalledWith("hash");
    });

    it("shows category in message when no examples match", () => {
      mockedIsRepoCloned.mockReturnValue(true);
      mockedListExamples.mockReturnValue([]);

      const result = listNoirExamples({ category: "nonexistent" });
      expect(result.message).toContain("nonexistent");
    });
  });

  describe("readNoirExample()", () => {
    it("returns failure when example is not found", () => {
      mockedFindExample.mockReturnValue(null);

      const result = readNoirExample({ name: "missing" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("returns failure when file is not readable", () => {
      mockedFindExample.mockReturnValue({
        path: "noir/examples/bad/src/main.nr",
        name: "bad",
        repo: "noir",
        type: "circuit",
      });
      mockedReadFile.mockReturnValue(null);

      const result = readNoirExample({ name: "bad" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("Could not read");
    });

    it("returns content on success", () => {
      mockedFindExample.mockReturnValue({
        path: "noir/examples/hello/src/main.nr",
        name: "hello",
        repo: "noir",
        type: "circuit",
      });
      mockedReadFile.mockReturnValue("fn main() {}");

      const result = readNoirExample({ name: "hello" });
      expect(result.success).toBe(true);
      expect(result.content).toBe("fn main() {}");
      expect(result.example?.name).toBe("hello");
    });
  });

  describe("readRepoFile()", () => {
    it("returns failure when file is not found", () => {
      mockedReadFile.mockReturnValue(null);

      const result = readRepoFile({ path: "missing/file.nr" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("File not found");
    });

    it("returns content on success", () => {
      mockedReadFile.mockReturnValue("some content");

      const result = readRepoFile({ path: "noir/src/main.nr" });
      expect(result.success).toBe(true);
      expect(result.content).toBe("some content");
    });
  });

  describe("listNoirLibraries()", () => {
    it("ignores invalid category", () => {
      mockedListLibraries.mockReturnValue([]);

      listNoirLibraries({ category: "invalid" });
      expect(mockedListLibraries).toHaveBeenCalledWith(undefined);
    });

    it("passes valid category", () => {
      mockedListLibraries.mockReturnValue([]);

      listNoirLibraries({ category: "libraries" });
      expect(mockedListLibraries).toHaveBeenCalledWith("libraries");
    });

    it("passes reference category", () => {
      mockedListLibraries.mockReturnValue([]);

      listNoirLibraries({ category: "reference" });
      expect(mockedListLibraries).toHaveBeenCalledWith("reference");
    });
  });
});
