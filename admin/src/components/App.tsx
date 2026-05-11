"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/wagmi";
import AdminDashboard from "./AdminDashboard";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#9B7FD4",
            accentColorForeground: "#0D0B14",
            borderRadius: "medium",
          })}
        >
          <AdminDashboard />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
