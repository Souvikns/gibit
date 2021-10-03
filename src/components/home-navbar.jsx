import React from "react";
import Spacer from "./spacer";

// eslint-disable-next-line import/no-anonymous-default-export
export default () => {
  return (
    <div>
      <nav className="bg-white dark:bg-gray-800  shadow ">
        <Spacer>
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div>
                <img src="/favicon.svg" alt="logo" className="w-8 h-8" />
              </div>

              <div className="ml-6">
                <h1 className="text-2xl font-bold text-gray-800">Gibit</h1>
              </div>
            </div>
          </div>
        </Spacer>
      </nav>
    </div>
  );
};
