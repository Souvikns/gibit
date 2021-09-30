import React from 'react';

const Spacer = ({children}) => {
  return <div className="mx-auto px-8 max-w-7xl">
    <div className="my-4">
      {children}
    </div>
  </div>
}

export default Spacer;