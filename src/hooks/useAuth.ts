"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface UserProfile {
  user_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setUser(data.session.user);
          setToken(data.session.access_token);
          await fetchProfile(data.session.access_token, data.session.user.id);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
          await fetchProfile(session.access_token, session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setToken(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(accessToken: string, userId: string) {
    try {
      const res = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        const data = (await res.json()) as { profile: UserProfile };
        setProfile(data.profile);
      } else {
        // Fallback local profile if backend is in local mock mode
        setProfile({
          user_id: userId,
          display_name: `User${userId.slice(0, 5)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      setProfile({
        user_id: userId,
        display_name: `User${userId.slice(0, 5)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function updateDisplayName(newDisplayName: string) {
    if (!token) return false;
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: newDisplayName }),
      });

      if (res.ok) {
        const data = (await res.json()) as { profile: UserProfile };
        setProfile(data.profile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setToken(null);
  }

  return {
    user,
    profile,
    token,
    loading,
    updateDisplayName,
    signOut,
  };
}
