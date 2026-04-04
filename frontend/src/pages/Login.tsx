import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CreativechainLogo } from "@/components/CreativechainLogo";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLocalError(null);
    clearError();
  };

  const validateForm = (): boolean => {
    if (!formData.username || formData.username.trim().length < 3) {
      setLocalError("Username must be at least 3 characters");
      return false;
    }

    if (!formData.password) {
      setLocalError("Password is required");
      return false;
    }

    // Registration has stricter password requirements (match backend: min 8 chars)
    if (isRegistering) {
      if (formData.password.length < 8) {
        setLocalError("Password must be at least 8 characters");
        return false;
      }

      if (!formData.email || !formData.email.includes("@")) {
        setLocalError("Please enter a valid email address");
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setLocalError("Passwords do not match");
        return false;
      }
    }
    // Login has lenient password check (just needs to exist)

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (isRegistering) {
        await register(
          formData.username,
          formData.email,
          formData.password,
          formData.firstName || undefined,
          formData.lastName || undefined
        );
      } else {
        await login(formData.username, formData.password);
      }

      // On success, navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      // Error is handled by context, don't need to set local error
      console.error("Auth error:", err);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Main card */}
      <div className="relative w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-lg backdrop-blur-sm p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <CreativechainLogo className="h-5 w-5 text-primary" />
              <span className="font-display font-bold text-sm">
                <span className="text-foreground">Creative</span>
                <span className="text-primary">Chain</span>
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-display font-bold text-2xl mb-2">
              {isRegistering ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRegistering
                ? "Join thousands of creators protecting their IP"
                : "Sign in to your CreativeChain account"}
            </p>
          </div>

          {/* Error message */}
          {displayError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{displayError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Username
              </label>
              <Input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="your_username"
                disabled={isLoading}
                className="w-full"
                required
              />
            </div>

            {/* Email (registration only) */}
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  disabled={isLoading}
                  className="w-full"
                  required
                />
              </div>
            )}

            {/* First Name (registration only) */}
            {isRegistering && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    First Name (Optional)
                  </label>
                  <Input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="John"
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Last Name (Optional)
                  </label>
                  <Input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Doe"
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (registration only) */}
            {isRegistering && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRegistering ? "Creating Account..." : "Signing In..."}
                </>
              ) : (
                <>
                  {isRegistering ? "Create Account" : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Toggle Registration */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isRegistering ? (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setIsRegistering(false);
                    setFormData((prev) => ({
                      ...prev,
                      email: "",
                      confirmPassword: "",
                      firstName: "",
                      lastName: "",
                    }));
                    clearError();
                    setLocalError(null);
                  }}
                  disabled={isLoading}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setIsRegistering(true);
                    clearError();
                    setLocalError(null);
                  }}
                  disabled={isLoading}
                  className="text-primary hover:underline font-medium disabled:opacity-50"
                >
                  Create One
                </button>
              </>
            )}
          </div>

          {/* Demo notice */}
          <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
            <p>
              Demo credentials:{" "}
              <span className="font-mono text-foreground">test</span> /{" "}
              <span className="font-mono text-foreground">test</span>
            </p>
          </div>
        </div>

        {/* Footer link */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <button
            onClick={() => navigate("/")}
            className="hover:text-foreground transition-colors underline"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}



