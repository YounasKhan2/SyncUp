import { useEffect, useState } from "react";
import { api } from "../shared/api";
import { isKeyBundleUnlocked } from "../features/auth/crypto/crypto";
import type { User } from "../shared/types";
import { AuthScreen } from "../features/auth/AuthScreen";
import { UnlockScreen } from "../features/auth/UnlockScreen";
import { WorkspacePage } from "../features/workspace/WorkspacePage";

export function AppRouter() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [vaultUnlocked, setVaultUnlocked] = useState(isKeyBundleUnlocked());

  useEffect(() => {
    let cancelled = false;
    api<{ user: User }>("/api/auth/me")
      .then((result) => {
        if (!cancelled) setUser(result.user);
      })
      .catch((error: unknown) => {
        if (
          !cancelled &&
          error instanceof Error &&
          error.message !== "Sign in required." &&
          error.message !== "Session expired."
        ) {
          setSessionError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingSession)
    return (
      <main className="loading-screen">
        <span>Getting your space ready?</span>
      </main>
    );
  if (sessionError)
    return (
      <main className="service-error">
        <p className="eyebrow">SERVICE UNAVAILABLE</p>
        <h1>We could not load your account.</h1>
        <p>{sessionError}</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>
    );
  if (!user) return <AuthScreen onSignedIn={setUser} />;
  if (!vaultUnlocked)
    return <UnlockScreen onUnlocked={() => setVaultUnlocked(true)} />;
  return (
    <WorkspacePage
      user={user}
      onSignedOut={() => {
        setUser(null);
        setVaultUnlocked(false);
      }}
    />
  );
}
