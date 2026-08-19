import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { toast } from "sonner";
import { playMessageChime, playPing } from "@/lib/notificationSound";

export interface AgentNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  trip_payment_id: string | null;
  trip_id: string | null;
  client_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useAgentNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["agent-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("agent_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AgentNotification[];
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`agent-notifications-realtime-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["agent-notifications", user.id] });

          const n = payload.new as AgentNotification | undefined;
          if (!n) return;
          // Team chat / DMs are announced by AgentChatWidget (it can suppress
          // toasts for the conversation already open) — don't double-notify.
          if (n.type === "agent_message") return;

          const isClientMessage = n.type === "client_message";
          if (isClientMessage) playMessageChime();
          else playPing(720);

          toast(n.title || "New notification", {
            description: n.message,
            duration: 8000,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("agent_notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-notifications", user?.id] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("agent_notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-notifications", user?.id] });
    },
  });

  const unreadCount = (query.data || []).filter((n) => !n.is_read).length;

  return {
    notifications: query.data || [],
    isLoading: query.isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
