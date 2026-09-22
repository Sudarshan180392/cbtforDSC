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
    const pastedText = (formData.get("pastedText") as string)?.trim();
    const defaultSection =
      (formData.get("defaultSection") as string)?.trim() || "General Intelligence";
    const defaultMarks =
      parseInt(formData.get("defaultMarks") as string) || 1;
    const apiKeyOverride = (formData.get("apiKey") as string)?.trim();
    const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;

    let questions: any[] = [];
    let engineUsed = "none";
    let warning: string | undefined;

    // Case 1: Pasted Text Provided Directly
    if (pastedText && pastedText.length > 0) {
      questions = parseQuestionsFromText(pastedText, defaultSection, defaultMarks);
      engineUsed = "text-parser";

      if (questions.length === 0) {
        return NextResponse.json(
          {
            error:
              "Could not parse questions from the pasted text. Ensure questions are numbered (e.g., 1., 2.) and have options (A, B, C, D).",
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        success: true,
        engine: engineUsed,
        count: questions.length,
        questions,
      });
    }

    // Case 2: PDF File Uploaded
    if (!file) {
      return NextResponse.json({ error: "Please provide either a PDF file or pasted text." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
      let rawPdfText = "";
      try {
        const pdfParsePkg = require("pdf-parse");
        if (typeof pdfParsePkg === "function") {
          const data = await pdfParsePkg(buffer);
          rawPdfText = data.text || "";
        } else if (pdfParsePkg?.PDFParse) {
          const parser = new pdfParsePkg.PDFParse({ data: buffer });
          const res = await parser.getText();
          rawPdfText = res?.text || "";
        }
      } catch (localError: any) {
        console.error("Local PDF parsing error:", localError);
      }

      if (!rawPdfText.trim()) {
        return NextResponse.json(
          {
            error:
              "No readable text could be extracted from this PDF. It may be a scanned image or photo PDF. Please use the 'Paste Text' tab, or provide a free Gemini API key to enable AI OCR.",
            isScanned: true,
          },
          { status: 422 }
        );
      }

      questions = parseQuestionsFromText(rawPdfText, defaultSection, defaultMarks);
      engineUsed = engineUsed === "none" ? "local" : engineUsed;
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
// Universal Text & Block Parser for Questions and Answer Keys
// -------------------------------------------------------------
function parseQuestionsFromText(
  rawText: string,
  defaultSection: string,
  defaultMarks: number
): any[] {
  if (!rawText || !rawText.trim()) return [];

  // 1. Extract Answer Key table/list (usually at the end or bottom)
  const answerKeyMap: { [key: number]: string } = {};
  const answerKeyRegex = /(?:answer\s*keys?|answers?|solutions?|key)\s*[:\n\r]([\s\S]*)$/i;
  const answerKeyMatch = rawText.match(answerKeyRegex);
  if (answerKeyMatch && answerKeyMatch[1]) {
    const keyBlock = answerKeyMatch[1];
    const itemRegex = /(?:Q(?:uestion)?\.?\s*)?(\d+)[\.\s:\-\)]+([A-D])\b/gi;
    let match;
    while ((match = itemRegex.exec(keyBlock)) !== null) {
      answerKeyMap[parseInt(match[1])] = match[2].toUpperCase();
    }
  }

  // Text prior to the answer key block
  let questionBlockText = rawText;
  if (answerKeyMatch) {
    questionBlockText = rawText.substring(0, answerKeyMatch.index);
  }

  const questions: any[] = [];

  // Match each question block starting with "1." or "Q1." or "1)" or "1 -"
  const qRegex = /(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*)?(\d+)[\.\)\:-]\s+([\s\S]+?)(?=(?:\n\s*(?:Q(?:uestion)?\.?\s*)?\d+[\.\)\:-]\s+)|$)/gi;
  let qMatch;

  while ((qMatch = qRegex.exec(questionBlockText)) !== null) {
    const qNum = parseInt(qMatch[1]);
    const block = qMatch[2].trim();

    // Regex to match options: A) or (A) or A. or A:
    const optRegex = /(?:^|\n|\s+)(?:\(|\[)?([A-D])(?:\)|\.|\:|\]|-)\s*([^\n\r]+?)(?=(?:\n|\s+)(?:\(|\[)?[A-D](?:\)|\.|\:|\]|-)|$)/gi;
    const opts: { [key: string]: string } = {};
    let optMatch;
    let firstOptIndex = -1;

    while ((optMatch = optRegex.exec(block)) !== null) {
      if (firstOptIndex === -1) {
        firstOptIndex = optMatch.index;
      }
      opts[optMatch[1].toUpperCase()] = optMatch[2].trim();
    }

    const qText = firstOptIndex !== -1 ? block.substring(0, firstOptIndex).trim() : block;

    if (qText && opts["A"] && opts["B"]) {
      questions.push({
        section: defaultSection,
        text: qText.replace(/\s+/g, " "),
        optionA: opts["A"] || "",
        optionB: opts["B"] || "",
        optionC: opts["C"] || "",
        optionD: opts["D"] || "",
        correctOption: answerKeyMap[qNum] || "A",
        marks: defaultMarks,
      });
    }
  }

  return questions;
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
