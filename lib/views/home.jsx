import Navbar from "../components/home-navbar";
import Spacer from "../components/spacer";

const HomeView = () => {
  return (
    <div>
      <Navbar />

      <Spacer>
        <div
          class="bg-yellow-200 border-yellow-600 text-yellow-600 border-l-4 p-4"
          role="alert"
        >
          <p class="font-bold">Alert</p>
          <p>🚧 Site under construction!!</p>
        </div>
      </Spacer>
    </div>
  );
};

module.exports = HomeView;
