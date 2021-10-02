import Axios from "axios";
import {useEffect, useState} from "react";

import {orgDetails, queryConstructor} from "./util";

const ORG_URL = "https://api.github.com/orgs/";
const ISSUES_URL = "https://api.github.com/search/issues";

export const useOrg = (orgName) => {
  const [org, setOrg] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState();

  const loadOrgDetails = async () => {
    try {
      const {data} = await Axios({
        method : "GET",
        url : ORG_URL + orgName,
      });
      setOrg(orgDetails(data));
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError(error);
    }
  };

  useEffect(() => { loadOrgDetails(); });

  return {isLoading, error, org};
};

export const useIssue = () => {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [issues, setIssues] = useState({});

  const fetch = async ({orgName, queryString, queryParams}, page = 1) => {
    setLoading(true);
    try {
      const {data} = await Axios({
        method : "GET",
        url : `${ISSUES_URL}?q=${queryConstructor({
          orgName,
          queryParams,
          queryString,
        })}&page=${page}`,
      });

      setIssues({
        total_count : data.total_count,
        items : data.items.map((el) => ({
                                 url : el.html_url,
                                 repo_url : el.repository_url,
                                 id : el.id,
                                 number : el.number,
                                 labels : el.labels,
                                 title : el.title,
                                 body : el.body,
                               })),
      });

      setLoading(false);
    } catch (error) {
      setError(error);
      setLoading(false);
    }
  };

  return {isLoading, error, issues, fetch};
};
