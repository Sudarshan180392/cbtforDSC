import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 60; // Allow up to 60s for PDF parsing

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await context.params;
  const examId = parseInt(params.id);
  if (isNaN(examId)) {
    return NextResponse.json({ error: "Invalid exam ID" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const defaultSection =
      (formData.get("defaultSection") as string)?.trim() || "General Intelligence";
    const defaultMarks =
      parseInt(formData.get("defaultMarks") as string) || 1;
    const apiKeyOverride = (formData.get("apiKey") as string)?.trim();
    const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let questions: any[] = [];
    let engineUsed = "none";
    let warning: string | undefined;

    // Strategy 1: Gemini AI (Multimodal Native PDF Extraction)
    if (apiKey) {
      try {
        const base64Data = buffer.toString("base64");
        questions = await extractWithGemini(base64Data, apiKey, defaultSection, defaultMarks);
        engineUsed = "gemini";
      } catch (geminiError: any) {
        console.error("Gemini PDF extraction failed, falling back to local:", geminiError);
        warning = `Gemini extraction notice: ${geminiError.message}. Fell back to local parser.`;
      }
    }

    // Strategy 2: Local PDF text parser fallback
    if (questions.length === 0) {
      try {
        questions = await extractWithLocalParser(buffer, defaultSection, defaultMarks);
        engineUsed = engineUsed === "none" ? "local" : engineUsed;
      } catch (localError: any) {
        console.error("Local PDF parsing error:", localError);
        if (!apiKey) {
          return NextResponse.json(
            {
              error:
                "Could not extract text from this PDF. Please check if the PDF is scanned or password protected.",
            },
            { status: 422 }
          );
        }
      }
    }

    if (questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No questions could be identified from the PDF. Ensure the PDF contains numbered questions (e.g. 1., 2.) with options A, B, C, D.",
          warning,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      engine: engineUsed,
      count: questions.length,
      questions,
      warning,
    });
  } catch (error: any) {
    console.error("PDF import endpoint error:", error);
    return NextResponse.json(
      { error: "Server error processing PDF: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

// -------------------------------------------------------------
// Gemini 2.5 / 1.5 Flash Multimodal Extraction
// -------------------------------------------------------------
async function extractWithGemini(
  base64Data: string,
  apiKey: string,
  defaultSection: string,
  defaultMarks: number
): Promise<any[]> {
  const prompt = `You are an expert exam paper digitizer specializing in Indian competitive exams (SSC CGL/CHSL, IBPS Banking, Railways RRB, State PSC, Punjab PSSSB/Police).

Carefully read every page of the attached exam paper PDF.
Extract ALL multiple-choice questions into a valid JSON array.

REQUIREMENTS:
1. Supported Languages: Extract questions verbatim in their original language. If the question is in Punjabi (Gurmukhi script) or Hindi (Devanagari) or English, preserve the exact original script and Unicode characters.
2. Structure for each question:
   - "section": The section name (e.g. "General Intelligence", "Quantitative Aptitude", "ਪੰਜਾਬੀ ਵਿਆਕਰਨ", "General Awareness"). If not specified in the document, use "${defaultSection}".
   - "text": The complete question text. Clean up leading numbers like "Q1." or "1." or "ਪ੍ਰਸ਼ਨ 1." from the start of the text.
   - "optionA": Text of option A (remove "(A)" or "A." or "A)" prefixes).
   - "optionB": Text of option B (remove "(B)" or "B." or "B)" prefixes).
   - "optionC": Text of option C (remove "(C)" or "C." or "C)" prefixes).
   - "optionD": Text of option D (remove "(D)" or "D." or "D)" prefixes).
   - "correctOption": Must be strictly "A", "B", "C", or "D". If an Answer Key table/list is included at the end or bottom of the paper, match each question number to its answer. If no answer key is found, choose the most probable correct option or default to "A".
   - "marks": ${defaultMarks}

RETURN ONLY A STRICT JSON ARRAY OF OBJECTS with no markdown fences, no explanatory text.
Example schema:
[
  {
    "section": "${defaultSection}",
    "text": "What is 35% of 480?",
    "optionA": "148",
    "optionB": "156",
    "optionC": "168",
    "optionD": "172",
    "correctOption": "C",
    "marks": ${defaultMarks}
  }
]`;

  const models = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: base64Data,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const content =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!content) {
        throw new Error("Empty response from Gemini");
      }

      const cleanJson = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q: any) => ({
          section: q.section || defaultSection,
          text: q.text || "",
          optionA: q.optionA || "",
          optionB: q.optionB || "",
          optionC: q.optionC || "",
          optionD: q.optionD || "",
          correctOption: ["A", "B", "C", "D"].includes(q.correctOption?.toUpperCase())
            ? q.correctOption.toUpperCase()
            : "A",
          marks: parseInt(q.marks) || defaultMarks,
        }));
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("Failed to extract questions with Gemini");
}

// -------------------------------------------------------------
// Local Robust Extraction Fallback (pdf-parse v1 & v2 compatible)
// -------------------------------------------------------------
async function extractWithLocalParser(
  buffer: Buffer,
  defaultSection: string,
  defaultMarks: number
): Promise<any[]> {
  let rawText = "";

  // pdf-parse v2+ exports { PDFParse: class }, while v1 was a direct function
  try {
    const pdfParsePkg = require("pdf-parse");
    if (typeof pdfParsePkg === "function") {
      const data = await pdfParsePkg(buffer);
      rawText = data.text || "";
    } else if (pdfParsePkg?.PDFParse) {
      const parser = new pdfParsePkg.PDFParse({ data: buffer });
      const res = await parser.getText();
      rawText = res?.text || "";
    } else if (pdfParsePkg?.default && typeof pdfParsePkg.default === "function") {
      const data = await pdfParsePkg.default(buffer);
      rawText = data.text || "";
    }
  } catch (err) {
    console.error("Failed to parse PDF with pdf-parse library:", err);
    throw err;
  }

  if (!rawText.trim()) return [];

  const questions: any[] = [];

  // Look for Answer Key table/list at the bottom or end of document
  const answerKeyMap: { [key: number]: string } = {};
  const answerKeyRegex = /(?:answer\s*keys?|answers?|solutions?)\s*[:\n\r]([\s\S]*)$/i;
  const answerKeyMatch = rawText.match(answerKeyRegex);
  if (answerKeyMatch && answerKeyMatch[1]) {
    const keyBlock = answerKeyMatch[1];
    // Matches patterns like: 1. C, 1 - C, 1) C, 1: C, Q1: C, 1.C, 1 C
    const itemRegex = /(?:Q(?:uestion)?\.?\s*)?(\d+)[\.\s:\-\)]+([A-D])\b/gi;
    let match;
    while ((match = itemRegex.exec(keyBlock)) !== null) {
      answerKeyMap[parseInt(match[1])] = match[2].toUpperCase();
    }
  }

  // Split text into lines
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let currentQuestion: any = null;
  let qNumber = 0;

  // Question start patterns: e.g. "1.", "Q1.", "Question 1:", "1)", "Q.1", "1 -"
  const qStartRegex = /^(?:Q(?:uestion)?\.?\s*)?(\d+)[\.\)\:-]\s*(.+)$/i;
  // Option start patterns: e.g. "A)", "A.", "(A)", "[A]", "A:"
  const optRegex = /^[\(\[]?([A-D])[\.\)\]\-:]\s*(.+)$/i;
  // Inline options pattern (multiple options on same line)
  const inlineOptRegex = /(?:^|\s+)(?:\(|\[)?([A-D])(?:\)|\.|\:|\]|-)\s*([^\n\r]+?)(?=(?:\s+(?:\(|\[)?[A-D](?:\)|\.|\:|\]|-))|$)/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stop parsing questions if we enter the answers block
    if (/^(?:answer\s*keys?|answers?|solutions?)\b/i.test(line)) {
      if (currentQuestion && currentQuestion.text && currentQuestion.optionA && currentQuestion.optionB) {
        questions.push(currentQuestion);
        currentQuestion = null;
      }
      break;
    }

    const qMatch = line.match(qStartRegex);
    if (qMatch) {
      // Save previous question
      if (currentQuestion && currentQuestion.text && currentQuestion.optionA && currentQuestion.optionB) {
        questions.push(currentQuestion);
      }

      qNumber = parseInt(qMatch[1]);
      const correctOpt = answerKeyMap[qNumber] || "A";

      currentQuestion = {
        section: defaultSection,
        text: qMatch[2],
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctOption: correctOpt,
        marks: defaultMarks,
      };
      continue;
    }

    if (!currentQuestion) continue;

    // Check if line contains inline options (e.g. "A) 148  B) 156  C) 168  D) 172")
    const inlineMatches = Array.from(line.matchAll(inlineOptRegex));
    if (inlineMatches.length >= 2) {
      for (const m of inlineMatches) {
        const letter = m[1].toUpperCase();
        const optVal = m[2].trim();
        if (letter === "A") currentQuestion.optionA = optVal;
        else if (letter === "B") currentQuestion.optionB = optVal;
        else if (letter === "C") currentQuestion.optionC = optVal;
        else if (letter === "D") currentQuestion.optionD = optVal;
      }
      continue;
    }

    // Check if line is a single option (e.g. "A) 148")
    const optMatch = line.match(optRegex);
    if (optMatch) {
      const optLetter = optMatch[1].toUpperCase();
      const optText = optMatch[2].trim();
      if (optLetter === "A") currentQuestion.optionA = optText;
      else if (optLetter === "B") currentQuestion.optionB = optText;
      else if (optLetter === "C") currentQuestion.optionC = optText;
      else if (optLetter === "D") currentQuestion.optionD = optText;
      continue;
    }

    // Continuation of question text or option
    if (!currentQuestion.optionA) {
      currentQuestion.text += " " + line;
    } else if (currentQuestion.optionD) {
      currentQuestion.optionD += " " + line;
    } else if (currentQuestion.optionC) {
      currentQuestion.optionC += " " + line;
    } else if (currentQuestion.optionB) {
      currentQuestion.optionB += " " + line;
    } else if (currentQuestion.optionA) {
      currentQuestion.optionA += " " + line;
    }
  }

  // Push last question
  if (currentQuestion && currentQuestion.text && currentQuestion.optionA && currentQuestion.optionB) {
    questions.push(currentQuestion);
  }

  return questions;
}
