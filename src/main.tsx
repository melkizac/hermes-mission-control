import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installPerformanceTelemetry } from "./services/performanceTelemetry";
import "./styles/tokens.css";
import "./styles/app.css";

installPerformanceTelemetry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
