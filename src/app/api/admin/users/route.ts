import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "SUPERADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, rollNo: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });
  return NextResponse.json(users);
}

export async function PATCH(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "SUPERADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, newRole } = await request.json();
  if (!["STUDENT", "ADMIN"].includes(newRole)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const updated = await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  return NextResponse.json(updated);
}
