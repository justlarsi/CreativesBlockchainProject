import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMarketplaceWorkDetail, type MarketplaceWorkDetail } from "@/api/marketplace";

export default function MarketplaceWorkDetailPage() {
  const { workId } = useParams();
  const [item, setItem] = useState<MarketplaceWorkDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  IPFS CID: {item.ipfs_metadata_cid || "Not pinned"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

