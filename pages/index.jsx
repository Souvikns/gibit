import HomeView from "../lib/views/home";
import OrgView from '../lib/views/org';

const App = () => {
  if(process.env.NEXT_PUBLIC_ORG_NAME) {
    return <OrgView />
  }
  return <HomeView />;
};

export default App;
