const {fetchOrgIssues, fetchOrgDetails} = require("../loader");

describe("FetchOrgShould", () => {
  test("should return response with custom queryString", async () => {
    const {result, error} = await fetchOrgIssues({
      queryString : "org:asyncapi",
    });
    expect(error).toBeUndefined();
    expect(result).toBeDefined();
  });

  test("should return response with only org name", async () => {
    const {result, error} = await fetchOrgIssues({
      queryString : "org:asyncapi",
    });
    expect(error).toBeUndefined();
    expect(result).toBeDefined();
  });
});

describe("FetchOrgDetails ", () => {
  test("should return orgs details", async () => {
    const {response, error} = await fetchOrgDetails("asyncapi");
    expect(error).toBeUndefined();
    expect(response).toBeDefined();
  });
});
