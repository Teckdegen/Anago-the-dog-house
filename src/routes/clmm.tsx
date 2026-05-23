import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ClmmNetworkGate } from "@/components/clmm/SwitchToMonadMainnet";

/** Layout — child routes: /clmm (index), /clmm/pool/:address, /clmm/pool/:address/add */
export const Route = createFileRoute("/clmm")({
  component: ClmmLayout,
});

function ClmmLayout() {
  return (
    <ClmmNetworkGate allowBrowse>
      <Outlet />
    </ClmmNetworkGate>
  );
}
