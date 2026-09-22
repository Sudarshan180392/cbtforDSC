import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    hasServerGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
  });
}
