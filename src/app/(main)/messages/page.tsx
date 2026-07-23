"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MESSAGE_TYPE_LABELS } from "@/lib/constants";
import type { Message } from "@/lib/types";
import { MessageSquare, Clock, FileText, CheckCircle, AlertCircle, Calendar, Circle } from "lucide-react";

function getMessageIcon(type: Message["type"]) {
  switch (type) {
    case "interview":
      return Calendar;
    case "apply":
      return FileText;
    case "result":
      return CheckCircle;
    case "trial":
    case "checkin":
    case "reminder":
    default:
      return AlertCircle;
  }
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      const supabase = createClient();
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/messages?userId=${user.id}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          setMessages(result.data as Message[]);
        }
      } catch (err) {
        console.warn("Error fetching messages:", err);
      }
      setLoading(false);
    }

    fetchMessages();
  }, []);

  const markAsRead = async (messageId: string) => {
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("id", messageId);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (err) {
      console.warn("Error marking message as read:", err);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6">加载中...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-brand-green">消息中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看通知和消息</p>
      </header>

      <div className="space-y-4">
        {messages.map((msg) => {
          const Icon = getMessageIcon(msg.type);
          return (
            <Card
              key={msg.id}
              className={`cursor-pointer transition-all ${
                !msg.is_read ? "ring-1 ring-brand-green/30 bg-brand-green/5" : ""
              }`}
              onClick={() => markAsRead(msg.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Icon className={`h-5 w-5 ${!msg.is_read ? 'text-brand-green' : 'text-gray-400'}`} />
                      {!msg.is_read && (
                        <Circle className="absolute -top-1 -right-1 h-2 w-2 fill-brand-green text-brand-green" />
                      )}
                    </div>
                    <div>
                      <CardTitle className={`text-base ${!msg.is_read ? 'font-bold' : 'font-normal'}`}>
                        {msg.title}
                      </CardTitle>
                      <Badge variant="muted" className="mt-1">
                        {MESSAGE_TYPE_LABELS[msg.type]}
                      </Badge>
                    </div>
                  </div>
                  {!msg.is_read && (
                    <Badge className="bg-brand-green text-white">未读</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-sm text-gray-700 mb-2 whitespace-pre-wrap ${!msg.is_read ? 'font-medium' : ''}`}>
                  {msg.content}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(msg.created_at).toLocaleString("zh-CN")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {messages.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">暂无消息</p>
        </div>
      )}
    </div>
  );
}