import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { useAuth } from "../hooks/useAuth";

export function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password, keepSignedIn);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
          setError("Invalid email or password");
        } else if (err.code === "auth/too-many-requests") {
          setError("Too many attempts. Please try again later.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Sign-in failed");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen companion-theme flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary">ShotReady Upload</h1>
          <p className="text-text-secondary mt-1">Sign in to upload photos</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-error text-sm">
            {error}
          </div>
        )}

        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-focus"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(e) => setKeepSignedIn(e.target.checked)}
            className="accent-accent"
          />
          Keep me signed in
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
