import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initAnalytics } from "./analytics/posthog";
import "./index.css";
initAnalytics();
createRoot(document.getElementById("root")!).render(<App />);
