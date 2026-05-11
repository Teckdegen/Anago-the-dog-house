"use client";

import dynamic from "next/dynamic";

// Load EVERYTHING client-side only - no SSR at all
const App = dynamic(() => import("@/components/App"), { ssr: false });

export default function Page() {
  return <App />;
}
