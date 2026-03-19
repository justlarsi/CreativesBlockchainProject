import { AppLayout } from "@/components/AppLayout";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  cursorFromUrl,
  listMarketplaceListings,
  type MarketplaceCategory,
  type MarketplaceLicenseType,
  type MarketplaceListItem,
} from "@/api/marketplace";

const categories: { label: string; value: MarketplaceCategory | "" }[] = [
  { label: "All", value: "" },
  { label: "Image", value: "image" },
  { label: "Audio", value: "audio" },
  { label: "Video", value: "video" },
  { label: "Text", value: "text" },
  { label: "Document", value: "document" },
];

const licenseTypes: { label: string; value: MarketplaceLicenseType | "" }[] = [
  { label: "All", value: "" },
  { label: "Personal", value: "personal" },
  { label: "Commercial", value: "commercial" },
  { label: "Exclusive", value: "exclusive" },
];

export default function Marketplace() {
  const [category, setCategory] = useState<MarketplaceCategory | "">("");
  const [licenseType, setLicenseType] = useState<MarketplaceLicenseType | "">("");
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<MarketplaceListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [previousCursor, setPreviousCursor] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const query = useMemo(
    () => ({
      category: category || undefined,
      license_type: licenseType || undefined,
      search: search.trim() || undefined,
      min_price: minPrice.trim() || undefined,
      max_price: maxPrice.trim() || undefined,
      cursor,
    }),
    [category, licenseType, search, minPrice, maxPrice, cursor],
  );

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    listMarketplaceListings(query)
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setItems(data.results || []);
        setNextCursor(cursorFromUrl(data.next));
        setPreviousCursor(cursorFromUrl(data.previous));
      })
      .catch((err: unknown) => {
        if (!isMounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load marketplace listings.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [query, reloadNonce]);

  const resetFilters = () => {
    setCategory("");
    setLicenseType("");
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setCursor(undefined);
  };

  return (
    <AppLayout title="Marketplace" subtitle="License creative works directly from creators">
      <div className="space-y-5 animate-fade-in">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.label}
                onClick={() => {
                  setCategory(cat.value);
                  setCursor(undefined);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  category === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursor(undefined);
              }}
              placeholder="Search title or description..."
              className="pl-8 pr-3 py-1.5 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground w-48 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center justify-start lg:justify-end">
            <select
              value={licenseType}
              onChange={(event) => {
                setLicenseType(event.target.value as MarketplaceLicenseType | "");
                setCursor(undefined);
              }}
              className="px-2.5 py-1.5 text-xs bg-muted rounded-lg border border-border"
            >
              {licenseTypes.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              value={minPrice}
              onChange={(event) => {
                setMinPrice(event.target.value);
                setCursor(undefined);
              }}
              placeholder="Min $"
              className="px-2.5 py-1.5 text-xs bg-muted rounded-lg border border-border w-20"
            />
            <input
              value={maxPrice}
              onChange={(event) => {
                setMaxPrice(event.target.value);
                setCursor(undefined);
              }}
              placeholder="Max $"
              className="px-2.5 py-1.5 text-xs bg-muted rounded-lg border border-border w-20"
            />
            <button onClick={resetFilters} className="text-xs text-primary hover:underline">
              Clear
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="stat-card rounded-xl p-12 text-center">
            <p className="text-sm font-medium text-foreground">Loading marketplace listings...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="stat-card rounded-xl p-12 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Could not load marketplace</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <button onClick={() => setReloadNonce((value) => value + 1)} className="text-xs text-primary hover:underline">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="stat-card rounded-xl p-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No listings found</p>
            <p className="text-xs text-muted-foreground mb-4">Try a different category or search term</p>
            <button onClick={resetFilters} className="text-xs text-primary hover:underline">
              Clear filters
            </button>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.work_id} className="stat-card rounded-xl overflow-hidden">
                <div className="relative h-24 bg-muted/50 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.category}</span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-semibold text-xs text-foreground mb-1 truncate">{item.title}</h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground truncate">{item.creator.username}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold text-base text-foreground">${item.price_amount}</div>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary capitalize">
                        {item.license_type}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description || "No description."}</p>

                  <Link
                    to={`/marketplace/works/${item.work_id}`}
                    className="block w-full py-2 bg-muted text-muted-foreground text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all text-center"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex items-center justify-end gap-2">
            <button
              disabled={!previousCursor}
              onClick={() => setCursor(previousCursor)}
              className="px-3 py-1.5 rounded-md text-xs bg-muted disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={!nextCursor}
              onClick={() => setCursor(nextCursor)}
              className="px-3 py-1.5 rounded-md text-xs bg-muted disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
