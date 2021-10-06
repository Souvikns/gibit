/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { useIssue } from "../hooks/loaders";

const IssueView = ({ title, url, id, body }) => {
  return (
    <li key={id} className="py-5 px-4">
      <div className="flex flex-col">
        <a target="_blank" href={url} rel="noreferrer" className="text-xl hover:text-green-400 font-bold">
          {title}
        </a>
        <div>
          {(body)? <h1 className="text-gray-600 w-4/5 h-20 overflow-ellipsis overflow-hidden py-4">{body}</h1>: null}
        </div>
      </div>
    </li>
  );
};

const IssueTable = ({ issues }) => {
  if (!issues) return null;
  return (
    <div className="px-4 py-5 rounded-t sm:px-6">
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {issues.map((el) => (
            <IssueView
              title={el.title}
              id={el.id}
              url={el.url}
              body={el.body}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

const IssueList = ({ org }) => {
  const { isLoading, fetch, issues } = useIssue();
  console.log(issues);

  useEffect(() => {
    fetch({ orgName: org });
  }, []);

  if (isLoading) {
    return <h1>Loading...</h1>;
  }

  return (
    <div>
      {typeof issues !== "undefined" ? (
        <IssueTable issues={issues.items} />
      ) : null}
    </div>
  );
};

export default IssueList;
