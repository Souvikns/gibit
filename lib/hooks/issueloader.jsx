import {useEffect, useState} from 'react';
import {fetchOrgIssues} from '../fetchers/loader';

export const useIssues = (options = {orgName}) => {
  const [OrgIssues, setOrgIssues] = useState([]);
  useEffect(() => {
    fetchOrgIssues(options).then(({result, error}) => {
      if(!error) {
        setOrgIssues(result);
      }
    })
  }, []);
  return OrgIssues;
}

