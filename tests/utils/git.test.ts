import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "path";

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}));

// Mock simple-git
const mockGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  fetch: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn().mockResolvedValue(undefined),
  pull: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue({ latest: { hash: "abc1234def5678" } }),
  raw: vi.fn().mockResolvedValue(""),
};

vi.mock("simple-git", () => ({
  simpleGit: vi.fn((...args: unknown[]) => {
    // When called with a path argument, return mockGit (repo-scoped)
    // When called without args, return mockGit (global)
    return mockGit;
  }),
}));

// Mock os.homedir
vi.mock("os", () => ({
  homedir: () => "/mock/home",
}));

// Set env before importing module
const TEST_REPOS_DIR = "/test/repos/dir";
process.env.NOIR_MCP_REPOS_DIR = TEST_REPOS_DIR;

const { existsSync, mkdirSync, rmSync } = await import("fs");
const {
  REPOS_DIR,
  getRepoPath,
  isRepoCloned,
  ensureReposDir,
  cloneRepo,
  updateRepo,
  getRepoCommit,
  getRepoTag,
  needsReclone,
  getReposStatus,
} = await import("../../src/utils/git.js");

const mockedExistsSync = vi.mocked(existsSync);

describe("utils/git", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("REPOS_DIR", () => {
    it("uses NOIR_MCP_REPOS_DIR env var", () => {
      expect(REPOS_DIR).toBe(join(TEST_REPOS_DIR, "repos"));
    });
  });

  describe("getRepoPath()", () => {
    it("joins REPOS_DIR with repo name", () => {
      expect(getRepoPath("noir")).toBe(join(REPOS_DIR, "noir"));
      expect(getRepoPath("noir-bignum")).toBe(join(REPOS_DIR, "noir-bignum"));
    });
  });

  describe("isRepoCloned()", () => {
    it("returns true when .git dir exists", () => {
      mockedExistsSync.mockReturnValue(true);
      expect(isRepoCloned("noir")).toBe(true);
      expect(mockedExistsSync).toHaveBeenCalledWith(
        join(REPOS_DIR, "noir", ".git")
      );
    });

    it("returns false when .git dir does not exist", () => {
      mockedExistsSync.mockReturnValue(false);
      expect(isRepoCloned("noir")).toBe(false);
    });
  });

  describe("ensureReposDir()", () => {
    it("creates the repos directory", () => {
      ensureReposDir();
      expect(mkdirSync).toHaveBeenCalledWith(REPOS_DIR, { recursive: true });
    });
  });

  describe("getRepoCommit()", () => {
    it("returns short hash by default", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.log.mockResolvedValue({ latest: { hash: "abc1234def5678" } });

      const commit = await getRepoCommit("noir");
      expect(commit).toBe("abc1234");
    });

    it("returns full hash when full=true", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.log.mockResolvedValue({ latest: { hash: "abc1234def5678" } });

      const commit = await getRepoCommit("noir", true);
      expect(commit).toBe("abc1234def5678");
    });

    it("returns null when repo is not cloned", async () => {
      mockedExistsSync.mockReturnValue(false);

      const commit = await getRepoCommit("noir");
      expect(commit).toBeNull();
    });

    it("returns null when log has no latest", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.log.mockResolvedValue({ latest: null });

      const commit = await getRepoCommit("noir");
      expect(commit).toBeNull();
    });
  });

  describe("getRepoTag()", () => {
    it("returns tag name when HEAD is a tag", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.raw.mockResolvedValue("v1.0.0-beta.18\n");

      const tag = await getRepoTag("noir");
      expect(tag).toBe("v1.0.0-beta.18");
    });

    it("returns null when repo is not cloned", async () => {
      mockedExistsSync.mockReturnValue(false);

      const tag = await getRepoTag("noir");
      expect(tag).toBeNull();
    });

    it("returns null when describe throws (not on a tag)", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.raw.mockRejectedValue(new Error("not a tag"));

      const tag = await getRepoTag("noir");
      expect(tag).toBeNull();
    });
  });

  describe("needsReclone()", () => {
    it("returns true when repo is not cloned", async () => {
      mockedExistsSync.mockReturnValue(false);

      const result = await needsReclone({
        name: "noir",
        url: "https://github.com/noir-lang/noir",
        description: "Noir",
        category: "core",
      });
      expect(result).toBe(true);
    });

    it("returns true when commit does not match", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.log.mockResolvedValue({ latest: { hash: "aaa1111bbb2222" } });

      const result = await needsReclone({
        name: "noir",
        url: "https://github.com/noir-lang/noir",
        description: "Noir",
        category: "core",
        commit: "ccc3333",
      });
      expect(result).toBe(true);
    });

    it("returns false when commit matches", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.log.mockResolvedValue({ latest: { hash: "abc1234def5678" } });

      const result = await needsReclone({
        name: "noir",
        url: "https://github.com/noir-lang/noir",
        description: "Noir",
        category: "core",
        commit: "abc1234def5678",
      });
      expect(result).toBe(false);
    });

    it("returns true when tag does not match", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.raw.mockResolvedValue("v0.9.0\n");

      const result = await needsReclone({
        name: "noir",
        url: "https://github.com/noir-lang/noir",
        description: "Noir",
        category: "core",
        tag: "v1.0.0",
      });
      expect(result).toBe(true);
    });

    it("returns false when tag matches", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.raw.mockResolvedValue("v1.0.0\n");

      const result = await needsReclone({
        name: "noir",
        url: "https://github.com/noir-lang/noir",
        description: "Noir",
        category: "core",
        tag: "v1.0.0",
      });
      expect(result).toBe(false);
    });

    it("returns false when no tag/commit in config and repo is cloned", async () => {
      mockedExistsSync.mockReturnValue(true);

      const result = await needsReclone({
        name: "noir-examples",
        url: "https://github.com/noir-lang/noir-examples",
        description: "Examples",
        category: "core",
      });
      expect(result).toBe(false);
    });
  });

  describe("cloneRepo()", () => {
    it("clones with sparse checkout when configured", async () => {
      mockedExistsSync.mockReturnValue(false);
      // needsReclone calls getRepoTag which calls raw(["describe",...]) — reject that
      // but sparse-checkout calls raw(["sparse-checkout",...]) — resolve that
      mockGit.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === "describe") throw new Error("not a tag");
        return ""; // sparse-checkout set
      });

      const result = await cloneRepo({
        name: "noir",
        url: "https://github.com/noir-lang/noir",
        branch: "master",
        tag: "v1.0.0",
        sparse: ["docs", "noir_stdlib"],
        description: "Noir",
        category: "core",
      });

      expect(result).toContain("Cloned noir");
      expect(result).toContain("sparse");
      expect(mockGit.clone).toHaveBeenCalled();
    });

    it("clones without sparse for small repos", async () => {
      mockedExistsSync.mockReturnValue(false);

      const result = await cloneRepo({
        name: "noir-examples",
        url: "https://github.com/noir-lang/noir-examples",
        branch: "master",
        description: "Examples",
        category: "core",
      });

      expect(result).toContain("Cloned noir-examples");
      expect(mockGit.clone).toHaveBeenCalled();
    });

    it("removes and re-clones when force=true and dir exists", async () => {
      // needsReclone returns true (not cloned) on first existsSync for .git
      // but dir exists for rmSync check
      mockedExistsSync.mockImplementation((path: unknown) => {
        const p = String(path);
        if (p.endsWith(".git")) return false;
        return true; // repo dir exists
      });

      await cloneRepo(
        {
          name: "noir-examples",
          url: "https://github.com/noir-lang/noir-examples",
          branch: "master",
          description: "Examples",
          category: "core",
        },
        true
      );

      expect(rmSync).toHaveBeenCalled();
    });
  });

  describe("updateRepo()", () => {
    it("fetches and resets on success", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.fetch.mockResolvedValue(undefined);
      mockGit.reset.mockResolvedValue(undefined);

      const result = await updateRepo("noir");
      expect(result).toBe("Updated noir");
    });

    it("falls back to pull when fetch+reset fails", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.fetch.mockRejectedValue(new Error("fetch fail"));
      mockGit.pull.mockResolvedValue(undefined);

      const result = await updateRepo("noir");
      expect(result).toBe("Updated noir");
    });

    it("returns error message when both fail", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.fetch.mockRejectedValue(new Error("fetch fail"));
      mockGit.pull.mockRejectedValue(new Error("pull fail"));

      const result = await updateRepo("noir");
      expect(result).toContain("Failed to update noir");
    });

    it("throws when repo is not cloned", async () => {
      mockedExistsSync.mockReturnValue(false);

      await expect(updateRepo("noir")).rejects.toThrow("not cloned");
    });
  });

  describe("getReposStatus()", () => {
    it("returns map of clone status and commits", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockGit.log.mockResolvedValue({ latest: { hash: "abc1234" } });

      const configs = [
        {
          name: "noir",
          url: "https://github.com/noir-lang/noir",
          description: "Noir",
          category: "core" as const,
        },
      ];

      const status = await getReposStatus(configs);
      expect(status.get("noir")).toEqual({
        cloned: true,
        commit: "abc1234",
      });
    });
  });
});
