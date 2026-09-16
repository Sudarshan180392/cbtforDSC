import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const prisma = new PrismaClient();

async function checkAdminAccess() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) return null;
  return role;
}

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { examId, section, text, optionA, optionB, optionC, optionD, correctOption, marks } = await request.json();
    const adminName = session.user?.name || "Admin";

    const question = await prisma.question.create({
      data: {
        examId: parseInt(examId),
        section,
        text,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        marks: parseInt(marks),
        addedBy: adminName,
      },
    });
    return NextResponse.json(question);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
