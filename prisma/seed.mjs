import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Create Superadmin (Sudarshan Mishra via Google)
  await prisma.user.upsert({
    where: { rollNo: "SUPERADMIN" },
    update: { role: "SUPERADMIN", email: "sudarshan.contactwebdev@gmail.com" },
    create: {
      rollNo: "SUPERADMIN",
      name: "Sudarshan Mishra",
      email: "sudarshan.contactwebdev@gmail.com",
      password: "not-used-google-auth",
      role: "SUPERADMIN",
    },
  });

  // Create a demo student
  await prisma.user.upsert({
    where: { rollNo: "SSC20260001" },
    update: {},
    create: {
      rollNo: "SSC20260001",
      name: "Rahul Kumar",
      password: "password123",
      role: "STUDENT",
    },
  });

  // Create Exam if not exists
  let exam = await prisma.exam.findFirst({ where: { title: "SSC CGL Tier 1 Mock Test" } });
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        title: "SSC CGL Tier 1 Mock Test",
        duration: 60,
        totalMarks: 200,
        negativeMarks: 0.5,
      },
    });

    await prisma.question.createMany({
      data: [
        { examId: exam.id, section: "General Intelligence", text: "Select the related word/letters/number from the given alternatives.\nBrain : Nerves :: Computer : ?", optionA: "Calculator", optionB: "Keyboard", optionC: "Mouse", optionD: "CPU", correctOption: "D", marks: 2 },
        { examId: exam.id, section: "General Intelligence", text: 'If A = 1, B = 2, C = 3, and so on, what is the value of the word "EXAM"?', optionA: "43", optionB: "42", optionC: "41", optionD: "44", correctOption: "A", marks: 2 },
        { examId: exam.id, section: "Quantitative Aptitude", text: "A sum of money doubles itself in 5 years at simple interest. What is the rate of interest?", optionA: "10%", optionB: "15%", optionC: "20%", optionD: "25%", correctOption: "C", marks: 2 },
        { examId: exam.id, section: "Quantitative Aptitude", text: "What is the square root of 1024?", optionA: "32", optionB: "34", optionC: "36", optionD: "38", correctOption: "A", marks: 2 },
        { examId: exam.id, section: "English Comprehension", text: 'Select the synonym of the given word: "Abundant"', optionA: "Scarce", optionB: "Plentiful", optionC: "Meager", optionD: "Sparse", correctOption: "B", marks: 2 },
        { examId: exam.id, section: "English Comprehension", text: "Fill in the blank: She _____ to the store yesterday.", optionA: "goes", optionB: "gone", optionC: "went", optionD: "going", correctOption: "C", marks: 2 },
        { examId: exam.id, section: "General Awareness", text: "Who was the first President of India?", optionA: "Jawaharlal Nehru", optionB: "Dr. Rajendra Prasad", optionC: "Sardar Vallabhbhai Patel", optionD: "B.R. Ambedkar", correctOption: "B", marks: 2 },
        { examId: exam.id, section: "General Awareness", text: "What is the capital of Australia?", optionA: "Sydney", optionB: "Melbourne", optionC: "Canberra", optionD: "Perth", correctOption: "C", marks: 2 },
      ],
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(0);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
