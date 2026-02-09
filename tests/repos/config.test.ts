import { describe, it, expect } from "vitest";
import {
  getNoirRepos,
  getReposByCategory,
  getCategoryNames,
  getRepoConfig,
  getRepoNames,
  NOIR_REPOS,
  DEFAULT_NOIR_VERSION,
  DEFAULT_BB_VERSION,
} from "../../src/repos/config.js";

describe("repos/config", () => {
  describe("BASE_REPOS via NOIR_REPOS", () => {
    it("has the expected number of repos", () => {
      expect(NOIR_REPOS.length).toBe(11);
    });

    it("has unique repo names", () => {
      const names = NOIR_REPOS.map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("every repo has a valid category", () => {
      const validCategories = ["core", "libraries", "reference"];
      for (const repo of NOIR_REPOS) {
        expect(validCategories).toContain(repo.category);
      }
    });

    it("every repo has required fields", () => {
      for (const repo of NOIR_REPOS) {
        expect(repo.name).toBeTruthy();
        expect(repo.url).toBeTruthy();
        expect(repo.description).toBeTruthy();
        expect(repo.category).toBeTruthy();
      }
    });
  });

  describe("getNoirRepos()", () => {
    it("sets tag on noir repo to DEFAULT_NOIR_VERSION", () => {
      const repos = getNoirRepos();
      const noir = repos.find((r) => r.name === "noir");
      expect(noir?.tag).toBe(DEFAULT_NOIR_VERSION);
    });

    it("sets tag on bb.js repo to DEFAULT_BB_VERSION", () => {
      const repos = getNoirRepos();
      const bb = repos.find((r) => r.name === "bb.js");
      expect(bb?.tag).toBe(DEFAULT_BB_VERSION);
    });

    it("does not set tag on other repos", () => {
      const repos = getNoirRepos();
      const others = repos.filter(
        (r) => r.name !== "noir" && r.name !== "bb.js"
      );
      for (const repo of others) {
        expect(repo.tag).toBeUndefined();
      }
    });

    it("applies custom version to noir repo only", () => {
      const customVersion = "v0.99.0";
      const repos = getNoirRepos(customVersion);
      const noir = repos.find((r) => r.name === "noir");
      expect(noir?.tag).toBe(customVersion);

      const bb = repos.find((r) => r.name === "bb.js");
      expect(bb?.tag).toBe(DEFAULT_BB_VERSION);
    });

    it("preserves other repo fields", () => {
      const repos = getNoirRepos();
      const noir = repos.find((r) => r.name === "noir");
      expect(noir?.url).toBe("https://github.com/noir-lang/noir");
      expect(noir?.branch).toBe("master");
      expect(noir?.sparse).toEqual(["docs", "noir_stdlib", "tooling", "examples"]);
      expect(noir?.category).toBe("core");
    });
  });

  describe("getReposByCategory()", () => {
    it("filters core repos", () => {
      const core = getReposByCategory("core");
      expect(core.length).toBeGreaterThan(0);
      expect(core.every((r) => r.category === "core")).toBe(true);
    });

    it("filters libraries repos", () => {
      const libs = getReposByCategory("libraries");
      expect(libs.length).toBeGreaterThan(0);
      expect(libs.every((r) => r.category === "libraries")).toBe(true);
    });

    it("filters reference repos", () => {
      const refs = getReposByCategory("reference");
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.every((r) => r.category === "reference")).toBe(true);
    });

    it("applies custom version when provided", () => {
      const core = getReposByCategory("core", "v0.50.0");
      const noir = core.find((r) => r.name === "noir");
      expect(noir?.tag).toBe("v0.50.0");
    });
  });

  describe("getCategoryNames()", () => {
    it("returns all three categories", () => {
      expect(getCategoryNames()).toEqual(["core", "libraries", "reference"]);
    });
  });

  describe("getRepoConfig()", () => {
    it("finds a repo by name", () => {
      const config = getRepoConfig("noir");
      expect(config).toBeDefined();
      expect(config?.name).toBe("noir");
    });

    it("returns undefined for unknown name", () => {
      expect(getRepoConfig("nonexistent-repo")).toBeUndefined();
    });
  });

  describe("getRepoNames()", () => {
    it("returns all repo names", () => {
      const names = getRepoNames();
      expect(names.length).toBe(NOIR_REPOS.length);
      expect(names).toContain("noir");
      expect(names).toContain("noir-examples");
      expect(names).toContain("noir-bignum");
    });
  });
});
