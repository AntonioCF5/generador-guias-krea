import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* global ZOHO */

ZOHO.embeddedApp.on("PageLoad", function (pageData) {
  const root = createRoot(document.getElementById("root"));
  root.render(<App pageData={pageData || {}} />);
});

ZOHO.embeddedApp.init();
