import '../index.css'

import {ThemeProvider} from "@primer/components";

function MyApp({Component, pageProps}) {
  return (<ThemeProvider><Component { ...pageProps } />
    </ThemeProvider>);
}

export default MyApp;
