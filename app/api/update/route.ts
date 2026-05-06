import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { id, updates } = await request.json();

    console.log("Incoming update:", id, updates);

    const { error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update route error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
