import { Header, StyledOcticon, Avatar } from "@primer/components";
import { IssueOpenedIcon } from "@primer/octicons-react";

const Navbar = ({ org_name, org_url, avatar_url }) => {
  return (
    <div>
      <Header>
        <Header.Item>
          <StyledOcticon icon={IssueOpenedIcon} size={32} mr={2} />
        </Header.Item>
        <Header.Item full>
          <h2>Gibit</h2>
        </Header.Item>

        <Header.Item mr={0}>
          <Header.Link href={org_url} target="_blank" >
            <Avatar
              square 
              src={avatar_url}
              size={30}
              />
          </Header.Link>
        </Header.Item>
      </Header>
    </div>
  );
};

export default Navbar;
