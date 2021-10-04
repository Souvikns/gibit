import React from "react";
import { useOrg } from "../hooks/loaders";
import Navbar from "../components/org-navbar";
import IssueList from '../components/issue-list';
import Spacer from "../components/spacer";

const Org = ({ org }) => {
  const { isLoading, error, org: Org } = useOrg(org);

  if (isLoading) {
    return <h1>Loading...</h1>;
  }

  if(error) {
    return <h1>No org found!</h1>
  }

  return (
    <div>
      <Navbar
        org_name={Org.org_name}
        avatar_url={Org.avatar_url}
        org_url={Org.org_url}
      />

      <Spacer>
        <IssueList org={org} />
      </Spacer>
    </div>
  );
};

export default Org;
