import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  useParams,
  Redirect
} from 'react-router-dom';

import HomeView from './pages/home';
import OrgView from './pages/org';

function App() {
  return <Router>
    <Switch>
      <Route exact path="/" children={<Home />} />
      <Route path="/:org" children={<Org />} />
    </Switch>
  </Router>
}

const Home = () => {
  if (process.env.REACT_APP_ORG_NAME) {
    return <OrgView org={process.env.REACT_APP_ORG_NAME} />
  }

  return <HomeView />
}

const Org = () => {
  if (process.env.REACT_APP_ORG_NAME) {
    return <Redirect to="/" />
  }
  const {org} = useParams();

  return <OrgView org={org} />
}


export default App;
