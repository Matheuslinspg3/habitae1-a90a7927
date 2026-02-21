import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Client-side redirect: habitae1.lovable.app → portadocorretor.com.br
if (
  window.location.hostname === "habitae1.lovable.app" &&
  !window.location.hostname.includes("preview")
) {
  window.location.replace(
    `https://portadocorretor.com.br${window.location.pathname}${window.location.search}${window.location.hash}`
  );
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
