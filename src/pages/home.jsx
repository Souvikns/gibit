import React from "react";
import Navbar from "../components/home-navbar";
import Spacer from "../components/spacer";
const Home = () => {
  return (
    <div>
      <Navbar />
      <Spacer>
        <h1 className="text-2xl font-bold">Index Page</h1>
      </Spacer>
    </div>
  );
};

export default Home;
