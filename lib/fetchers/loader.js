const { Octokit } = require("@octokit/core");
const { queryConstructor } = require("./util");
const ocktokit = new Octokit();

const fetchOrgIssues = async ({ orgName, queryString, queryParams, page }) => {
  const query = queryConstructor({ orgName, queryString, queryParams });
  try {
    const response = await ocktokit.request("GET /search/issues", {
      q: query,
      page: page || 0,
      per_page: 10,
    });
    return { response };
  } catch (error) {
    return { undefined, error };
  }
};

const fetchOrgDetails = async (orgName) => {
  try {
    const response = await ocktokit.request("GET /orgs/{org}", {
      org: orgName,
    });
    return { response };
  } catch (error) {
    return { undefined, error };
  }
};

module.exports = {
  fetchOrgIssues,
  fetchOrgDetails
};
