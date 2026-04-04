import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMarketplaceWorkDetail, type MarketplaceWorkDetail } from "@/api/marketplace";
import {
  certificateDownloadUrl,
  prepareLicensePurchase,
  submitLicenseReceipt,
  type RightsScope,
} from "@/api/licensing";
import { useWalletContext } from "@/context/WalletContext";
import { walletErrorMessage } from "@/blockchain/wallet";
import { useSendTransaction } from "wagmi";

function buildIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `license-receipt-${crypto.randomUUID()}`;
  }
  return `license-receipt-${Date.now()}`;
}

export default function MarketplaceWorkDetailPage() {
  const { workId } = useParams();
  const accessToken = localStorage.getItem("access_token") || localStorage.getItem("access");
  const [item, setItem] = useState<MarketplaceWorkDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<number | null>(null);

  const { isConnected, isCorrectChain } = useWalletContext();
  const { sendTransactionAsync } = useSendTransaction();


  useEffect(() => {
    if (!workId) {
      setError("Missing work id.");
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getMarketplaceWorkDetail(Number(workId))
      .then((data) => {
        if (isMounted) {
          setItem(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load listing detail.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [workId]);

  async function handlePurchase(): Promise<void> {
    if (!item) {
      return;
    }
    setIsPurchasing(true);
    setPurchaseError(null);
    setPurchaseMessage(null);

    try {
      if (!isConnected) {
        throw new Error("Connect your wallet before purchasing a license.");
      }
      if (!isCorrectChain) {
        throw new Error("Switch your wallet to Polygon Amoy before purchasing.");
      }

      const rightsScope: RightsScope = item.license_type === "personal" ? "non_commercial" : "commercial";
      const prepared = await prepareLicensePurchase({
        work_id: item.work_id,
        template: item.license_type,
        rights_scope: rightsScope,
      });

      const txHash = await sendTransactionAsync({
        to: prepared.to as `0x${string}`,
        data: prepared.data as `0x${string}`,
        value: BigInt(prepared.value),
      });

      const receiptResult = await submitLicenseReceipt(accessToken || "", {
        purchase_id: prepared.purchase_id,
        idempotency_key: buildIdempotencyKey(),
        tx_hash: txHash,
      });

      setPurchaseId(prepared.purchase_id);
      setPurchaseMessage(receiptResult.message);
    } catch (err) {
      if (err instanceof Error) {
        setPurchaseError(err.message);
      } else {
        setPurchaseError(walletErrorMessage(err));
      }
    } finally {
      setIsPurchasing(false);
    }
  }

  async function openCertificate(): Promise<void> {
    if (!purchaseId || !accessToken) {
      return;
    }
    const response = await fetch(certificateDownloadUrl(purchaseId), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to download certificate.");
    }
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `license-certificate-${purchaseId}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  }

  return (
    <AppLayout title="Marketplace Detail" subtitle="Public listing detail">
      <div className="space-y-4 animate-fade-in">
        <Link to="/marketplace" className="text-xs text-primary hover:underline">
          Back to marketplace
        </Link>

        {isLoading && (
          <div className="stat-card rounded-xl p-8">
            <p className="text-sm text-foreground">Loading listing details...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="stat-card rounded-xl p-8">
            <p className="text-sm font-medium text-foreground mb-1">Could not load listing detail</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!isLoading && !error && item && (
          <div className="stat-card rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl text-foreground">{item.title}</h2>
              <p className="text-xs text-muted-foreground capitalize">
                {item.category} - {item.status.toLowerCase().replaceAll("_", " ")}
              </p>
            </div>

            <p className="text-sm text-foreground">{item.description || "No description provided."}</p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">Creator</p>
                <p className="text-sm font-medium text-foreground">{item.creator.username}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.creator.bio || "No bio provided."}</p>
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  Wallet: {item.creator.wallet_address || "Not available"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">License</p>
                <p className="text-sm font-medium text-foreground capitalize">{item.license_type}</p>
                <p className="text-sm text-foreground mt-1">Price: ${item.price_amount}</p>
                <p className="text-xs text-muted-foreground mt-1 break-all">Price (wei): {item.price_wei}</p>
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  IPFS CID: {item.ipfs_metadata_cid || "Not pinned"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                Creator payout model: 100% of payment goes to creator via LicenseAgreement.
              </p>
              {!accessToken && <p className="text-xs text-muted-foreground">Sign in to buy this license.</p>}
              {purchaseError && <p className="text-xs text-destructive">{purchaseError}</p>}
              {purchaseMessage && <p className="text-xs text-foreground">{purchaseMessage}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={isPurchasing || !accessToken}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPurchasing ? "Processing purchase..." : `Purchase ${item.license_type} license`}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    openCertificate().catch((err: unknown) => {
                      const message = err instanceof Error ? err.message : "Failed to download certificate.";
                      setPurchaseError(message);
                    });
                  }}
                  disabled={!purchaseId}
                  className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download certificate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

