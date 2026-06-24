import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router.js";
import "./index.css";

const rootEl = document.getElementById("root");
if (rootEl === null) {
  throw new Error("missing #root mount node");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
