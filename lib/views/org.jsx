import { useRouter } from "next/router";
import { useLoader } from "../hooks/loader";
import Header from '../components/org-navbar';

const OrgView = () => {
  const router = useRouter();
  if (router.query.org && process.env.NEXT_PUBLIC_ORG_NAME) {
    router.replace("/");
  }

  const { org } = useLoader(router.query.org);

  if (!org) {
    return null;
  }

  return (
    <div>
      <Header
        org_name={org.name}
        org_url={org.html_url}
        avatar_url={org.avatar_url}
      />
    </div>
  );
};

module.exports = OrgView;

