import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../hooks/useAuth";
import { Loader2 } from "lucide-react";

export function SignIn() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password, keepSignedIn);
      }
    } catch (err) {
      if (err instanceof FirebaseError) {
        const messages: Record<string, string> = {
          "auth/invalid-credential": "Invalid email or password",
          "auth/wrong-password": "Invalid email or password",
          "auth/user-not-found": "Invalid email or password",
          "auth/too-many-requests": "Too many attempts. Please try again later.",
          "auth/email-already-in-use": "An account with this email already exists",
          "auth/weak-password": "Password must be at least 6 characters",
          "auth/invalid-email": "Please enter a valid email address",
        };
        setError(messages[err.code] ?? err.message);
      } else {
        setError(mode === "signup" ? "Sign-up failed" : "Sign-in failed");
      }
      setSubmitting(false);
    }
  }

  const isSignUp = mode === "signup";

  const inputClass =
    "w-full px-4 py-3 bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors";

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero image (hidden on mobile) */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img
          src="/images/feature-interior.jpg"
          alt="Modern kitchen with natural light"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay + enlarger glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/30 to-black/70" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 50% 40% at 50% 60%, rgba(212,165,116,0.1) 0%, transparent 70%)",
          }}
        />
        {/* Branding on image */}
        <div className="absolute bottom-12 left-12 right-12">
          <h2 className="font-heading text-4xl font-600 text-white tracking-tight leading-tight mb-3">
            From Booking<br />to Delivery
          </h2>
          <p className="text-white/70 text-sm max-w-xs leading-relaxed">
            Upload, process, and deliver listing photos — all from one place.
          </p>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Warm gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, hsl(28 20% 12%) 0%, hsl(20 19% 7%) 70%)",
          }}
        />

        {/* Film-grain texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 w-full max-w-sm animate-slide-in">
          {/* Brand header */}
          <div className="text-center mb-10">
            <h1 className="font-heading text-3xl font-600 text-foreground tracking-tight">
              ShotReady
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isSignUp
                ? "Create your photographer account"
                : "Sign in to upload and deliver photos"}
            </p>
          </div>

          {/* Card */}
          <div className="bg-card border border-border rounded-lg p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md px-4 py-3 text-destructive text-sm animate-slide-in">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-body font-500 tracking-[0.04em] uppercase text-muted-foreground mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-body font-500 tracking-[0.04em] uppercase text-muted-foreground mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className={inputClass}
                />
              </div>

              {isSignUp && (
                <div>
                  <label className="block text-xs font-body font-500 tracking-[0.04em] uppercase text-muted-foreground mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>
              )}

              {!isSignUp && (
                <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-accent"
                  />
                  Keep me signed in
                </label>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-accent w-full py-3 bg-accent text-accent-foreground font-body text-sm font-600 tracking-[0.05em] uppercase rounded-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isSignUp ? "Creating Account" : "Signing In"}
                  </>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  await signInWithGoogle();
                } catch (err) {
                  if (err instanceof FirebaseError) {
                    if (err.code === "auth/popup-closed-by-user") return;
                    setError(`Google sign-in failed: ${err.code}`);
                  } else {
                    setError(`Google sign-in failed: ${err}`);
                  }
                }
              }}
              className="w-full py-3 bg-card border border-border rounded-md text-foreground text-sm font-500 hover:bg-secondary transition-colors flex items-center justify-center gap-3"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Toggle sign-in / sign-up */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button onClick={switchMode} className="text-accent hover:underline font-500">
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button onClick={switchMode} className="text-accent hover:underline font-500">
                  Sign up
                </button>
              </>
            )}
          </p>

          {/* Footer link back to landing */}
          <p className="text-center text-xs text-muted-foreground mt-3">
            <a href="/" className="text-accent hover:underline">
              Back to ShotReady
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
