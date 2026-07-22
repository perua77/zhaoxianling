"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

interface UseAuthReturn {
  userId: string | null;
  roles: UserRole[] | null;
  fullName: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [userId, setUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<UserRole[] | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);

      try {
        const supabase = createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          setUserId(null);
          setRoles(null);
          setFullName(null);
          setPhone(null);
          setAge(null);
          setGender(null);
          setLoading(false);
          return;
        }

        setUserId(user.id);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, roles, age, gender")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          setRoles(["candidate"] as UserRole[]);
          setFullName(null);
          setPhone(null);
          setAge(null);
          setGender(null);
          setLoading(false);
          return;
        }

        setRoles((profile.roles as UserRole[]) || ["candidate"]);
        setFullName(profile.full_name || null);
        setPhone(profile.phone || null);
        setAge(profile.age || null);
        setGender(profile.gender || null);
      } catch (err) {
        console.warn("Auth fetch error:", err);
        setUserId(null);
        setRoles(null);
        setFullName(null);
        setPhone(null);
        setAge(null);
        setGender(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  return {
    userId,
    roles,
    fullName,
    phone,
    age,
    gender,
    loading,
  };
}