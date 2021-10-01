const queryConstructor = ({ orgName, queryString, queryParams }) => {
  if (typeof queryString === "string") {
    return queryString;
  }
  let query = "org:" + orgName;
  if (typeof queryParams !== "undefined") {
    query = query + "+" + queryParams.join("+");
  }
  query = query + "+is:open";
  return query;
};

module.exports = {
  queryConstructor,
};
