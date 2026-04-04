import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WalletProvider } from "@/context/WalletContext";
import { wagmiConfig } from "@/blockchain/wagmiConfig";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Works from "./pages/Works";
import Marketplace from "./pages/Marketplace";
import MarketplaceWorkDetailPage from "./pages/MarketplaceWorkDetail";
import Infringement from "./pages/Infringement";
import Collaboration from "./pages/Collaboration";
import Legal from "./pages/Legal";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/works" element={<ProtectedRoute><Works /></ProtectedRoute>} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/marketplace/works/:workId" element={<MarketplaceWorkDetailPage />} />
                <Route path="/infringement" element={<ProtectedRoute><Infringement /></ProtectedRoute>} />
                <Route path="/collaboration" element={<ProtectedRoute><Collaboration /></ProtectedRoute>} />
                <Route path="/legal" element={<ProtectedRoute><Legal /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
