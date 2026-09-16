import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, rollNo: true, name: true, results: { select: { score: true, examId: true } } },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(students);
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const { name, rollNo, password } = await request.json();
    if (!name || !rollNo || !password) {
      return NextResponse.json({ error: "Name, Roll No and Password are required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { rollNo } });
    if (existing) {
      return NextResponse.json({ error: "Roll No already exists" }, { status: 409 });
    }
    const student = await prisma.user.create({
      data: { name, rollNo, password, role: "STUDENT" },
    });
    return NextResponse.json(student);
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
