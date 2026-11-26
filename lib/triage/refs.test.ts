import { expect, test } from "bun:test";
import { formatRef, parseRef } from "./refs";

test("parseRef parses owner/repo#number", () => {
  expect(parseRef(" asyncapi/cli#123 ")).toEqual({ owner: "asyncapi", name: "cli", number: 123 });
  expect(parseRef("asyncapi/spec-json-schemas#7")).toEqual({ owner: "asyncapi", name: "spec-json-schemas", number: 7 });
});

test("parseRef rejects malformed refs", () => {
  expect(parseRef("asyncapi/cli")).toBeNull();
  expect(parseRef("asyncapi#1")).toBeNull();
  expect(parseRef("asyncapi/cli#0")).toBeNull();
  expect(parseRef("asyncapi/cli#abc")).toBeNull();
  expect(parseRef("-bad/cli#1")).toBeNull();
});

test("formatRef round-trips", () => {
  expect(formatRef("asyncapi", "cli", 9)).toBe("asyncapi/cli#9");
});
