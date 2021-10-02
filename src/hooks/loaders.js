import Axios from "axios";
import { useEffect, useState } from "react";

import { orgDetails } from "./util";

const ORG_URL = "https://api.github.com/orgs/";
const ISSUES_URL = "https://api.github.com/search/issues?q=";

export const useOrg = (orgName) => {
  const [org, setOrg] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState();

  const loadOrgDetails = async () => {
    try {
      const { data } = await Axios({
        method: "GET",
        url: ORG_URL + orgName,
      });
      setOrg(orgDetails(data));
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError(error);
    }
  };

  useEffect(() => {
    loadOrgDetails();
  }, []);

  return { isLoading, error, org };
};
