import { createConfig, http } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const AMOY_CHAIN_ID = polygonAmoy.id;

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

const connectors = [
  injected({ shimDisconnect: true }),
];

if (walletConnectProjectId) {
  connectors.push(
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
      metadata: {
        name: "CreativeChain",
        description: "CreativeChain wallet connection",
        url: "https://creativechain.local",
        icons: [],
      },
    }),
  );
}

export const walletConnectEnabled = Boolean(walletConnectProjectId);

export const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  connectors,
  transports: {
    [polygonAmoy.id]: http(import.meta.env.VITE_RPC_URL || polygonAmoy.rpcUrls.default.http[0]),
  },
});

