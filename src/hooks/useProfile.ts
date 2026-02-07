import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ProfileData {
  id?: string;
  full_name: string;
  phone: string;
  job_title: string;
  agency_name: string;
  avatar_url: string;
  commission_rate: number;
}

const defaultProfile: ProfileData = {
  full_name: "",
  phone: "",
  job_title: "Travel Agent",
  agency_name: "",
  avatar_url: "",
  commission_rate: 10,
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name || "",
          phone: data.phone || "",
          job_title: data.job_title || "Travel Agent",
          agency_name: data.agency_name || "",
          avatar_url: data.avatar_url || "",
          commission_rate: data.commission_rate || 10,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (newProfile: Partial<ProfileData>) => {
    if (!user) {
      toast.error("You must be logged in to save your profile");
      return false;
    }

    setSaving(true);
    try {
      const updatedProfile = { ...profile, ...newProfile };

      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          full_name: updatedProfile.full_name,
          phone: updatedProfile.phone,
          job_title: updatedProfile.job_title,
          agency_name: updatedProfile.agency_name,
          avatar_url: updatedProfile.avatar_url,
          commission_rate: updatedProfile.commission_rate,
        }, {
          onConflict: "user_id",
        });

      if (error) {
        console.error("Error saving profile:", error);
        toast.error("Failed to save profile");
        return false;
      }

      setProfile(updatedProfile);
      toast.success("Profile saved successfully");
      return true;
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) {
      toast.error("You must be logged in to upload an avatar");
      return null;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    try {
      // First, ensure the avatars bucket exists or use logos bucket
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(`avatars/${fileName}`, file, { upsert: true });

      if (uploadError) {
        console.error("Error uploading avatar:", uploadError);
        toast.error("Failed to upload avatar");
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("logos")
        .getPublicUrl(`avatars/${fileName}`);

      const avatarUrl = `${publicUrl}?v=${Date.now()}`;
      
      await saveProfile({ avatar_url: avatarUrl });
      return avatarUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
      return null;
    }
  };

  return {
    profile,
    loading,
    saving,
    saveProfile,
    uploadAvatar,
    userEmail: user?.email || "",
    refetch: fetchProfile,
  };
}
