import { useState, useEffect } from "react";
import { fetchOrgDetails, fetchOrgIssues } from "../fetchers";

export const useLoader = (org) => {
  const [Org, setOrg] = useState({});
  const [loading, setLoading] = useState(true);
  const [orgIssues, setOrgIssues] = useState([]);

  useEffect(() => {
    fetchOrgDetails(org).then(({ response, error }) => {
      if (!error) {
        setOrg({
          avatar_url: response.data.avatar_url,
          html_url: response.data.html_url,
          name: response.data.name,
          description: response.data.description,
        });
        setLoading(false);
      }
    });
  });

  return [loading, { org: Org }];
};
