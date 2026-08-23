import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validate, type Template } from "./core";

/**
 * The check that runs over the templates in this repository.
 *
 * `npm run check` is this file, so a pull request that would be rejected by
 * Meta is rejected here first, before anyone waits a day to find out. Warnings
 * are left alone: a template being written is allowed to be unfinished.
 */
const DIR = path.join(process.cwd(), "templates");

const files = (() => {
  try {
    return readdirSync(DIR).filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }
})();

describe("templates in this repository", () => {
  if (files.length === 0) {
    it("has nothing to check yet", () => {
      expect(files).toEqual([]);
    });
    return;
  }

  for (const file of files) {
    it(`${file} would pass review`, () => {
      const template = JSON.parse(readFileSync(path.join(DIR, file), "utf8")) as Template;
      const result = validate(template);
      expect(
        result.errors,
        `${file}\n${result.errors.map((issue) => `  ${issue.path}: ${issue.message}`).join("\n")}`,
      ).toEqual([]);
    });
  }
});
