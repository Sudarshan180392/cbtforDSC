import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { examId, section, text, optionA, optionB, optionC, optionD, correctOption, marks } = await request.json();
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
      },
    });
    return NextResponse.json(question);
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
