import { useSendTransaction } from "wagmi";
import { walletErrorMessage } from "@/blockchain/wallet";
import {
  BlockchainReceiptQueuedResponse,
  prepareBlockchainRegistration,
  submitBlockchainReceipt,
} from "@/api/works";
import { useWalletContext } from "@/context/WalletContext";

function getAccessToken(): string {
  return localStorage.getItem("access") || localStorage.getItem("access_token") || "";
}

export function useRegisterWorkOnChain() {
  const { isConnected, isCorrectChain } = useWalletContext();
  const { sendTransactionAsync } = useSendTransaction();

  const registerWorkOnChain = async (workId: number): Promise<BlockchainReceiptQueuedResponse> => {
	if (!isConnected) {
	  throw new Error("Connect your wallet before blockchain registration.");
	}

	if (!isCorrectChain) {
	  throw new Error("Switch your wallet to Polygon Amoy before blockchain registration.");
	}

	const accessToken = getAccessToken();
	if (!accessToken) {
	  throw new Error("Sign in first to continue blockchain registration.");
	}

	const payload = await prepareBlockchainRegistration(accessToken, workId);

	try {
	  const txHash = await sendTransactionAsync({
		to: payload.to as `0x${string}`,
		data: payload.data as `0x${string}`,
	  });

	  return submitBlockchainReceipt(accessToken, workId, txHash);
	} catch (error) {
	  throw new Error(walletErrorMessage(error));
	}
  };

  return {
	registerWorkOnChain,
  };
}

