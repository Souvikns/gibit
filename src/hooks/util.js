export const orgDetails = (data) => {
  return {
    org_name : data.name,
    org_url : data.html_url,
    avatar_url : data.avatar_url,
  };
};

export const queryConstructor = ({orgName, queryString, queryParams}) => {
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
