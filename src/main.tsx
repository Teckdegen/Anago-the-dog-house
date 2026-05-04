import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import { Web3Provider } from "./lib/web3/Web3Provider";
import { ToastProvider } from "./components/Toast";
// Side-effect import: initializes Reown AppKit (web components + modal).
import "./lib/web3/config";
import "./styles.css";

const router = getRouter();
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Web3Provider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </Web3Provider>
  </StrictMode>,
);
