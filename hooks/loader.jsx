import React, {useState, useEffect} from 'react';
import {fetchOrgDetails} from '../lib/ocktokit';


export const useLoader = (org) => {
  const [Org, setOrg] = useState({});

  useEffect(() => {
    fetchOrgDetails(org).then(({response, error}) => {
      if (!error) {
        setOrg({
          avatar_url: response.data.avatar_url,
          html_url: response.data.html_url,
          name: response.data.name,
          description: response.data.description
        })
      }
    })
  })

  return {
    org: Org
  }
}