const constructQueryParameter = ({ org, queryParams }) => {
  let queryString = `org:${org}`;
  if (queryParams) {
    queryString = queryString + queryParams.join("+");
  }
  queryString = queryString + "is:open";
  return queryString;
};

const queryConstructor = ({
  orgName,
  queryString,
  queryParams
}) => {
  if (typeof queryString === 'string') {
    return queryString;
  }
  let query = "org:"+orgName;
  if(typeof queryParams !== "undefined") {
    query = query + "+" +queryParams.join('+') + "+is:open"
  }
  return query;
}

module.exports = {
  constructQueryParameter,
  queryConstructor
};
