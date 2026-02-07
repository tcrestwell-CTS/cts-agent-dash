import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Eye, EyeOff } from "lucide-react";
import crestwellLogo from "@/assets/crestwell-logo.png";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signOut } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authMode, setAuthMode] = useState<"google" | "email">("google");
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const inviteToken = searchParams.get("invite");
  const switchAccount = searchParams.get("switch");

  // If switch=true, sign out immediately
  useEffect(() => {
    if (switchAccount === "true" && user && !isSigningOut) {
      setIsSigningOut(true);
      signOut().then(() => {
        setIsSigningOut(false);
        window.history.replaceState({}, "", "/auth");
      });
    }
  }, [switchAccount, user, signOut, isSigningOut]);

  // If there's an invite token, default to signup mode
  useEffect(() => {
    if (inviteToken) {
      setAuthMode("email");
      setEmailMode("signup");
    }
  }, [inviteToken]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const handlePostAuth = async () => {
      setIsValidating(true);
      const userEmail = user.email?.toLowerCase();

      try {
        // Check if user is already a team member (has a profile)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingProfile) {
          navigate("/", { replace: true });
          return;
        }

        // New user - check for valid invitation
        let hasValidInvitation = false;

        if (inviteToken) {
          const { data: tokenInvite } = await supabase
            .from("invitations")
            .select("id, email, status, expires_at")
            .eq("token", inviteToken)
            .eq("status", "pending")
            .maybeSingle();

          if (tokenInvite && new Date(tokenInvite.expires_at) > new Date()) {
            if (tokenInvite.email === userEmail) {
              hasValidInvitation = true;
              const { data, error } = await supabase.rpc("accept_invitation", {
                invitation_token: inviteToken,
                accepting_user_id: user.id,
              });

              if (error) {
                console.error("Error accepting invitation:", error);
                toast.error("Failed to accept invitation. Please try again.");
              } else if (data) {
                toast.success("Welcome! Your account has been set up.");
              }
            } else {
              toast.error("This invitation was sent to a different email address.");
              await signOut();
              setIsValidating(false);
              return;
            }
          }
        }

        if (!hasValidInvitation && userEmail) {
          const { data: emailInvite } = await supabase
            .from("invitations")
            .select("id, token, status, expires_at")
            .eq("email", userEmail)
            .eq("status", "pending")
            .maybeSingle();

          if (emailInvite && new Date(emailInvite.expires_at) > new Date()) {
            hasValidInvitation = true;
            const { data, error } = await supabase.rpc("accept_invitation", {
              invitation_token: emailInvite.token,
              accepting_user_id: user.id,
            });

            if (error) {
              console.error("Error accepting invitation:", error);
              toast.error("Failed to accept invitation. Please try again.");
            } else if (data) {
              toast.success("Welcome! Your account has been set up.");
            }
          }
        }

        if (!hasValidInvitation) {
          toast.error("Access denied. You need a valid invitation to join Crestwell Travel Services.");
          await signOut();
          setIsValidating(false);
          return;
        }

        navigate("/", { replace: true });
      } catch (err) {
        console.error("Error validating access:", err);
        toast.error("An error occurred while validating your access.");
        await signOut();
      } finally {
        setIsValidating(false);
      }
    };

    handlePostAuth();
  }, [user, loading, navigate, inviteToken, signOut]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth" + (inviteToken ? `?invite=${inviteToken}` : ""),
        extraParams: {
          prompt: "select_account",
        },
      });
      if (result.error) {
        toast.error(result.error.message || "Failed to sign in with Google");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const validateForm = () => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setEmailError(emailResult.error.errors[0].message);
      isValid = false;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setPasswordError(passwordResult.error.errors[0].message);
      isValid = false;
    }

    if (emailMode === "signup" && password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      isValid = false;
    }

    return isValid;
  };

  const handleEmailSignIn = async () => {
    if (!validateForm()) return;

    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password. Please try again.");
        } else {
          toast.error(error.message);
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailSignUp = async () => {
    if (!validateForm()) return;

    setIsSigningIn(true);
    try {
      // First verify there's a valid invitation for this email
      const emailLower = email.toLowerCase().trim();
      
      const { data: invitation } = await supabase
        .from("invitations")
        .select("id, token, status, expires_at")
        .eq("email", emailLower)
        .eq("status", "pending")
        .maybeSingle();

      if (!invitation) {
        toast.error("No invitation found for this email address. Please contact an administrator.");
        setIsSigningIn(false);
        return;
      }

      if (new Date(invitation.expires_at) <= new Date()) {
        toast.error("Your invitation has expired. Please contact an administrator for a new one.");
        setIsSigningIn(false);
        return;
      }

      // Create the account
      const redirectUrl = `${window.location.origin}/auth?invite=${invitation.token}`;
      const { error } = await supabase.auth.signUp({
        email: emailLower,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("This email is already registered. Please sign in instead.");
          setEmailMode("signin");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Account created! Please check your email to verify your account.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Sign up error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-32 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
          {isValidating && (
            <p className="text-sm text-muted-foreground">Validating your access...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-ocean p-12 flex-col justify-between">
        <div className="bg-white/95 rounded-xl p-4 w-fit">
          <img
            alt="Crestwell Travel Services"
            className="h-16 w-auto object-contain"
            src="/lovable-uploads/ca8734b5-c59b-4dd9-9431-498d1e25746a.png"
          />
        </div>

        <div className="space-y-6">
          <p className="text-lg text-white/80">
            Manage clients, bookings, commissions, and training all in one place.
            Built for modern travel professionals.
          </p>
          <div className="flex items-center gap-8 pt-4">
            <div>
              <p className="text-3xl font-semibold text-white">500+</p>
              <p className="text-white/70">Travel Agents</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-white">$2M+</p>
              <p className="text-white/70">Commissions Tracked</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-white">10K+</p>
              <p className="text-white/70">Bookings Made</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-white/60">
          © 2026 Crestwell Travel Services. All rights reserved.
        </p>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src={crestwellLogo}
              alt="Crestwell Travel Services"
              className="h-16 w-auto object-contain"
            />
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-semibold text-foreground tracking-tight">
              {emailMode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {emailMode === "signup" 
                ? "Set up your account using your invited email" 
                : "Sign in to access your travel agency dashboard"}
            </p>
          </div>

          {authMode === "google" ? (
            <div className="space-y-4">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3 h-12"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isSigningIn ? "Signing in..." : "Continue with Google"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              <Button
                variant="secondary"
                size="lg"
                className="w-full gap-3 h-12"
                onClick={() => setAuthMode("email")}
              >
                <Mail className="h-5 w-5" />
                Use Email & Password
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className={emailError ? "border-destructive" : ""}
                />
                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className={passwordError ? "border-destructive pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
              </div>

              {emailMode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-12"
                onClick={emailMode === "signup" ? handleEmailSignUp : handleEmailSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn 
                  ? (emailMode === "signup" ? "Creating account..." : "Signing in...") 
                  : (emailMode === "signup" ? "Create Account" : "Sign In")}
              </Button>

              <div className="flex flex-col gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setEmailMode(emailMode === "signin" ? "signup" : "signin")}
                  className="text-sm text-primary hover:underline"
                >
                  {emailMode === "signin" 
                    ? "Have an invitation? Create an account" 
                    : "Already have an account? Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("google")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to Google sign-in
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-4 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                This site is for members of Crestwell Travel Services only. All
                data contained within is proprietary and confidential.
                Unauthorized access is subject to legal prosecution.
              </p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-sm font-medium text-primary">
                🔒 Invite-only access. You must have a valid invitation to sign in.
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              By signing in, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;