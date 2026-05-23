import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /clmm/pool/:address and /clmm/pool/:address/add */
export const Route = createFileRoute("/clmm/pool/$poolAddress")({
  component: () => <Outlet />,
});
