import { expect, test } from "bun:test";
import { isValidLogin, isValidRepoName, parseRepoFullName } from "./names";

test("isValidLogin follows GitHub's login grammar", () => {
  expect(isValidLogin("asyncapi")).toBe(true);
  expect(isValidLogin("a-b")).toBe(true);
  expect(isValidLogin("-ab")).toBe(false);
  expect(isValidLogin("a".repeat(40))).toBe(false);
});

test("isValidRepoName allows dots, dashes, underscores", () => {
  expect(isValidRepoName("spec-json-schemas")).toBe(true);
  expect(isValidRepoName("asyncapi.github.io")).toBe(true);
  expect(isValidRepoName("bad/name")).toBe(false);
  expect(isValidRepoName("..")).toBe(false);
});

test("parseRepoFullName accepts owner/name and GitHub URLs", () => {
  expect(parseRepoFullName("asyncapi/cli")).toEqual({ owner: "asyncapi", name: "cli" });
  expect(parseRepoFullName(" https://github.com/asyncapi/cli/ ")).toEqual({ owner: "asyncapi", name: "cli" });
  expect(parseRepoFullName("github.com/asyncapi/cli.git")).toEqual({ owner: "asyncapi", name: "cli" });
  expect(parseRepoFullName("asyncapi")).toBeNull();
  expect(parseRepoFullName("a/b/c")).toBeNull();
});
