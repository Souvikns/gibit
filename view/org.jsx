import { useRouter } from "next/router";
import { Box, Avatar, Link } from "@primer/components";
import { useLoader } from "../hooks/loader";
import Header from "../components/header";

const OrgView = () => {
  const router = useRouter();
  const { org } = useLoader(router.query.org);

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
