import { describe, expect, test } from "bun:test";
import { DEFAULT_FILTERS, parseFilters, serializeFilters } from "./filters";

describe("URL filters", () => {
  test("parses valid values and falls back for invalid values", () => {
    const filters = parseFilters(
      new URLSearchParams("state=closed&q=login&repo=web&sort=comments&page=3"),
    );
    expect(filters).toEqual({ state: "closed", query: "login", repo: "web", sort: "comments", page: 3 });
    expect(parseFilters(new URLSearchParams("state=invalid&sort=invalid&page=nope"))).toEqual(
      DEFAULT_FILTERS,
    );
  });

  test("omits default values from canonical URLs", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
    expect(
      serializeFilters({ ...DEFAULT_FILTERS, state: "all", query: "bug report", page: 2 }),
    ).toBe("?state=all&q=bug+report&page=2");
  });
});
