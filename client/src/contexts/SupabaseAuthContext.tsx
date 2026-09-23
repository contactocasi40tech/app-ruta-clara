import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearIndexedDbSession, indexedDbStorage } from "@/lib/indexedDbStorage";
import { buildSessionPolicy, type SessionPolicy } from "@/lib/sessionPolicy";
import { supabase } from "@/lib/supabase";

const SESSION_POLICY_KEY = "ruta-clara-session-policy";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  recoveryMode: boolean;
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signInWithGoogle: (remember: boolean) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function savePolicy(remember: boolean) {
  await indexedDbStorage.setItem(SESSION_POLICY_KEY, JSON.stringify(buildSessionPolicy(remember)));
}

async function policyExpired() {
  const raw = await indexedDbStorage.getItem(SESSION_POLICY_KEY);
  if (!raw) return false;
  try {
    const policy = JSON.parse(raw) as SessionPolicy;
    return Date.now() >= policy.expiresAt;
  } catch {
    return true;
  }
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const expired = await policyExpired();
      if (expired) {
        await supabase.auth.signOut({ scope: "local" });
        await clearIndexedDbSession();
      }
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    await savePolicy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
    await savePolicy(remember);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async (remember: boolean) => {
    await savePolicy(remember);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecoveryMode(false);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await clearIndexedDbSession();
    setSession(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw error;
    await supabase.auth.signOut({ scope: "local" });
    await clearIndexedDbSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      recoveryMode,
      signUp,
      signIn,
      signInWithGoogle,
      sendPasswordReset,
      updatePassword,
      signOut,
      deleteAccount,
    }),
    [session, loading, recoveryMode, signUp, signIn, signInWithGoogle, sendPasswordReset, updatePassword, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useSupabaseAuth debe usarse dentro de SupabaseAuthProvider");
  return context;
}
