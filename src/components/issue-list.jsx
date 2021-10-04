/* eslint-disable react-hooks/exhaustive-deps */
import React, {useEffect} from "react";
import { useIssue } from "../hooks/loaders";

const IssueList = ({ org }) => {
  const { isLoading, fetch, issues } = useIssue();

  useEffect(() => {
    fetch({orgName: org});
  }, [])

  if(isLoading) {
    return <h1>Loading...</h1>
  }

  return <div>
    {issues.items ? issues.items.map(el => <h1 key={el.id}>{el.title}</h1>): null}
  </div>;
};

export default IssueList;
