const {Octokit} = require("@octokit/core");

const ocktokit = new Octokit();

module.exports = {
  fetchOrgIssues : async (orgName) => {
    try {
      const response = await ocktokit.request("GET /search/issues", {
        q : `org:${orgName}+is:open`,
        page : 3,
        per_page : 10,
      });
      return {response};
    } catch (error) {
      return {undefined, error};
    }
  },
  fetchOrgDetails : async (org) => {
    try {
      const response = await ocktokit.request("GET /orgs/{org}", {
        org : org,
      });
      return {response};
    } catch (error) {
      return {undefined, error};
    }
  },
};
