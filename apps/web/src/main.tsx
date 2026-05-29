import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Console branding
console.log(
  "%c" +
    [
      " _____ _           _   ______               _       ",
      "/  ___| |         | |  | ___ \\             | |      ",
      "\\ `--.| |__   ___ | |_ | |_/ /___  __ _  __| |_   _ ",
      " `--. \\ '_ \\ / _ \\| __||    // _ \\/ _` |/ _` | | | |",
      "/\\__/ / | | | (_) | |_ | |\\ \\  __/ (_| | (_| | |_| |",
      "\\____/|_| |_|\\___/ \\__|\\_| \\_\\___|\\__,_|\\__,_|\\__, |",
      "                                               __/ |",
      "                                              |___/ ",
    ].join("\n"),
  "color: #D4A574; font-family: monospace; font-size: 11px;",
);
console.log(
  "%cThe darkroom never sleeps. Your photos develop here.",
  "color: #8B6B4A; font-size: 12px; font-style: italic;",
);
console.log(
  "%cv1.0 — shotready.app",
  "color: #8A7D70; font-size: 10px;",
);

// Scroll-triggered reveals
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 },
);

// Observe .reveal elements after DOM is ready
const observeReveals = () => {
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
};

// Run on initial load and re-run on navigation
const mo = new MutationObserver(observeReveals);
mo.observe(document.getElementById("root")!, { childList: true, subtree: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
