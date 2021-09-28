const { fetchOrgIssues, fetchOrgDetails } = require("../ocktokit");

describe("FetchOrgIssues shoudld ", () => {
  test("fetch organization issues", async () => {
    const { response, error } = await fetchOrgIssues("asyncapi");
    expect(error).toBeUndefined();
    expect(response).toBeDefined();
  }, 10000);
});

describe("FetchOrgData Should", () => {
  test("", async () => {
    const { response, error } = await fetchOrgDetails("asyncapi");
    expect(error).toBeUndefined();
    console.log(response);
    expect(response).toBeDefined();
  });
});
