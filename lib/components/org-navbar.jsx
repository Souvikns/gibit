import Spacer from "./spacer";

const Navbar = ({ org_name, org_url, avatar_url }) => {
  return (
    <div className="bg-white dark:bg-gray-800  shadow">
      <Spacer>
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="rounded-full">
              <img src={avatar_url} alt="avatar" className="h-12 w-12" />
            </div>

            <div className="ml-6">
              <h1 className="text-xl font-medium text-gray-600">{org_name}</h1>
            </div>
          </div>
        </div>
      </Spacer>
    </div>
  );
};

export default Navbar;
