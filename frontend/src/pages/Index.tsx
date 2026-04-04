import heroBg from "@/assets/hero-bg.jpg";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CreativechainLogo } from "@/components/CreativechainLogo";
import { Shield, Eye, FileCheck, Zap, Users, Globe, ArrowRight, CheckCircle, Lock, TrendingUp, Hexagon } from "lucide-react";

const features = [
  { icon: Shield, title: "Blockchain Ownership", description: "Immutable proof of creation timestamped on Polygon — undisputable in any legal proceeding." },
  { icon: Eye, title: "AI Infringement Detection", description: "Automated 24/7 similarity scanning across the web using perceptual hashing and ML models." },
  { icon: FileCheck, title: "Smart License Marketplace", description: "Direct creator-to-buyer licensing with smart contracts. Keep 100% of your revenue." },
  { icon: Zap, title: "Automated Legal Tools", description: "Generate DMCA takedown notices and cease & desist letters in minutes, not days." },
  { icon: Users, title: "Collaboration Splits", description: "Transparent multi-party revenue splits via smart contracts. Every contributor gets paid fairly." },
  { icon: Globe, title: "Global Marketplace", description: "Reach buyers worldwide with M-Pesa and crypto payment support." },
];

const stats = [
  { value: "$71B+", label: "Annual IP Theft Loss" },
  { value: "91%", label: "Creators Affected" },
  { value: "0%", label: "Platform Commission" },
  { value: "60s", label: "Registration Time" },
];

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreativechainLogo className="h-4 w-4 text-primary" />
            <span className="font-display font-bold text-base">
              <span className="text-foreground">Creative</span><span className="text-primary">Chain</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#stats" className="hover:text-foreground transition-colors">Impact</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {isAuthenticated ? "Dashboard" : "Sign In"}
            </button>
            <button onClick={handleGetStarted} className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-all">
              {isAuthenticated ? "Go to Dashboard" : "Get Started"}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-14">
        <div className="absolute inset-0 bg-cover bg-center opacity-10" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
            <Zap className="h-3 w-3" />
            Powered by Polygon Blockchain
          </div>

          <h1 className="font-display font-bold text-5xl md:text-6xl leading-tight mb-5">
            Protect Your<br />
            <span className="gradient-text">Creative Legacy</span>
          </h1>

          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Blockchain timestamping, AI detection, and smart contract licensing — built for African creators with 0% platform fees.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleGetStarted}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-teal group text-sm"
            >
              Start Protecting
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => navigate("/marketplace")}
              className="flex items-center gap-2 px-6 py-3 border border-border text-foreground font-semibold rounded-xl hover:border-primary/30 hover:bg-primary/5 transition-all text-sm"
            >
              Browse Marketplace
            </button>
          </div>

          <div className="flex items-center justify-center gap-5 mt-8 text-xs text-muted-foreground">
            {["No credit card required", "Free forever plan", "Kenya-first"].map((item) => (
              <div key={item} className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="font-display font-bold text-3xl md:text-4xl gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">Everything a Creator Needs</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">Six powerful tools working together to protect and monetize your creative work.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="stat-card rounded-xl p-5 group">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm mb-1.5">{feature.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-y border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">How It Works</h2>
            <p className="text-muted-foreground text-sm">Three steps to permanent IP protection</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: Lock, title: "Upload & Register", desc: "Generate a cryptographic fingerprint timestamped on Polygon blockchain in under 60 seconds." },
              { step: "02", icon: Eye, title: "AI Monitors 24/7", desc: "Continuous scanning for unauthorized use, with instant alerts when infringement is detected." },
              { step: "03", icon: TrendingUp, title: "License & Earn", desc: "List on our marketplace, set your prices. Buyers pay via smart contract — you keep 100%." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-display font-bold text-primary/10 mb-3">{item.step}</div>
                <div className="flex justify-center mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <h3 className="font-display font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-4">
            Ready to Protect Your <span className="gradient-text">Creative Work?</span>
          </h2>
          <p className="text-muted-foreground text-sm mb-8">Join thousands of Kenyan creators securing their IP on the blockchain.</p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-teal text-sm"
          >
            Launch Dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hexagon className="h-3.5 w-3.5 text-primary" />
            <span className="font-display font-bold text-sm">
              <span className="text-foreground">Creative</span><span className="text-primary">Chain</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 CreativeChain · Built for African creators · Polygon blockchain</p>
        </div>
      </footer>
    </div>
  );
}
