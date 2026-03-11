import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { Search, Heart, Star, Zap, Eye } from "lucide-react";
import { LicenseDialog } from "@/components/LicenseDialog";

const categories = ["All", "Illustration", "Photography", "Music", "Writing", "3D Art"];

const listings = [
  { id: 1, title: "Nairobi Street Series", creator: "Zara Njoroge", avatar: "ZN", type: "Photography", price: 45, license: "Commercial", rating: 4.9, reviews: 23, views: 1842, emoji: "📷", hot: true },
  { id: 2, title: "Afrobeats Production Kit", creator: "James Mwangi", avatar: "JM", type: "Music", price: 120, license: "Extended", rating: 5.0, reviews: 8, views: 934, emoji: "🎵", hot: false },
  { id: 3, title: "Tribal Pattern Collection", creator: "Amara Okonkwo", avatar: "AO", type: "Illustration", price: 30, license: "Personal", rating: 4.7, reviews: 45, views: 3210, emoji: "🎨", hot: true },
  { id: 4, title: "Savanna Wildlife Photos", creator: "Kioni Wambua", avatar: "KW", type: "Photography", price: 75, license: "Commercial", rating: 4.8, reviews: 17, views: 2156, emoji: "🦁", hot: false },
  { id: 5, title: "Short Story — The Rift", creator: "Nia Abubakar", avatar: "NA", type: "Writing", price: 15, license: "Personal", rating: 4.6, reviews: 62, views: 784, emoji: "✍️", hot: false },
  { id: 6, title: "Tech Startup Illustrations", creator: "Amara Okonkwo", avatar: "AO", type: "Illustration", price: 200, license: "Extended", rating: 5.0, reviews: 12, views: 4521, emoji: "🚀", hot: true },
];

const licenseColors: Record<string, string> = {
  Personal: "bg-muted text-muted-foreground",
  Commercial: "bg-chart-3/15 text-chart-3",
  Extended: "bg-primary/15 text-primary",
};

export default function Marketplace() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [liked, setLiked] = useState<number[]>([]);
  const [licenseWork, setLicenseWork] = useState<typeof listings[0] | null>(null);

  const filtered = listings.filter((l) => {
    const matchCat = category === "All" || l.type === category;
    const matchSearch = l.title.toLowerCase().includes(search.toLowerCase()) || l.creator.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <AppLayout title="Marketplace" subtitle="License creative works directly from creators">
      <div className="space-y-5 animate-fade-in">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  category === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search creator or work..."
              className="pl-8 pr-3 py-1.5 text-xs bg-muted rounded-lg border border-border focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground w-48 transition-all"
            />
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="stat-card rounded-xl p-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No listings found</p>
            <p className="text-xs text-muted-foreground mb-4">Try a different category or search term</p>
            <button onClick={() => { setCategory("All"); setSearch(""); }} className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <div key={item.id} className="stat-card rounded-xl overflow-hidden group cursor-pointer">
                <div className="relative h-36 bg-muted/50 flex items-center justify-center">
                  <span className="text-5xl">{item.emoji}</span>
                  {item.hot && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-chart-3 text-xs font-bold text-background">
                      <Zap className="h-2.5 w-2.5" />Hot
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLiked((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]);
                    }}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-background/30 backdrop-blur-sm hover:bg-background/50 transition-colors"
                  >
                    <Heart className={`h-3.5 w-3.5 transition-colors ${liked.includes(item.id) ? "fill-destructive text-destructive" : "text-foreground"}`} />
                  </button>
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background/30 backdrop-blur-sm text-xs text-foreground">
                    <Eye className="h-2.5 w-2.5" />{item.views.toLocaleString()}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-semibold text-xs text-foreground mb-1 truncate">{item.title}</h3>
                      <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-primary">{item.avatar}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{item.creator}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold text-base text-foreground">${item.price}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${licenseColors[item.license]}`}>{item.license}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-chart-3 text-chart-3" />
                      <span className="text-xs font-semibold text-foreground">{item.rating}</span>
                      <span className="text-xs text-muted-foreground">({item.reviews})</span>
                    </div>
                    <span className="text-xs badge-verified px-1.5 py-0.5 rounded-full">✓ Verified</span>
                  </div>

                  <button
                    onClick={() => setLicenseWork(item)}
                    className="w-full py-2 bg-muted text-muted-foreground text-xs font-semibold rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    License This Work
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LicenseDialog
        open={!!licenseWork}
        onOpenChange={(open) => !open && setLicenseWork(null)}
        work={licenseWork ? { title: licenseWork.title, creator: licenseWork.creator, price: licenseWork.price, license: licenseWork.license } : undefined}
      />
    </AppLayout>
  );
}
