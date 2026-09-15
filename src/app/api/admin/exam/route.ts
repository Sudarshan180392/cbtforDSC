import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const exams = await prisma.exam.findMany({
       include: {
          _count: {
             select: { questions: true, results: true }
          }
       },
       orderBy: { id: "desc" }
    });
    return NextResponse.json(exams);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, duration, totalMarks, negativeMarks } = await request.json();
    const exam = await prisma.exam.create({
      data: {
        title,
        duration: parseInt(duration),
        totalMarks: parseInt(totalMarks),
        negativeMarks: parseFloat(negativeMarks),
      },
    });
    return NextResponse.json(exam);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
