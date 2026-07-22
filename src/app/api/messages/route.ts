import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json(
      { success: false, error: String(error), data: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { recipient_id, type, title, content } = body;

  if (!recipient_id || !type || !title || !content) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabase.from("messages").insert({
      recipient_id,
      type,
      title,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ success: true, message: "消息发送成功" });
  } catch (error) {
    console.error("Messages insert error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function sendMessage(recipient_id: string, type: string, title: string, content: string) {
  try {
    const { error } = await supabase.from("messages").insert({
      recipient_id,
      type,
      title,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to send message:", error);
    }
  } catch (error) {
    console.error("Send message error:", error);
  }
}