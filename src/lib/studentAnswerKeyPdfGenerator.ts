/**
 * Zero-dependency standards-compliant PDF 1.4 Generator for Student Answer Keys & Solutions
 * Generates vector A4 PDFs containing:
 * - Top Header: Institute name ("Crack Academy") on Page 1 ONLY
 * - Footer: "PDF created by Sudarshan Mishra" on ALL pages
 * - Questions with Correct Answer & Student's Answer directly below (no option lists)
 */

export interface QuestionAnswerItem {
  number: number;
  section: string;
  text: string;
  correctOption: string;       // "A", "B", "C", or "D"
  correctOptionText: string;   // Text of the correct option
  selectedOption: string | null; // Student's chosen option letter or null
  selectedOptionText: string | null;
  marks: number;
  status: "CORRECT" | "INCORRECT" | "SKIPPED";
  marksEarned: number;
}

export interface StudentAnswerKeyReportData {
  instituteName?: string; // defaults to "Crack Academy"
  studentName: string;
  rollNo: string;
  examTitle: string;
  examDuration: number;
  totalMarks: number;
  negativeMarks: number;
  submittedAt: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  questions: QuestionAnswerItem[];
}

function normalizeToAscii(str: string): string {
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u2022]/g, '*');
}

function escapePdfText(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  const normalized = normalizeToAscii(String(str));
  return normalized
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' '); // Clean printable ASCII
}

function wrapText(text: string, maxWidth: number, fontSize: number, isBold: boolean = false): string[] {
  const approxCharWidth = fontSize * (isBold ? 0.55 : 0.51);
  const maxChars = Math.max(15, Math.floor(maxWidth / approxCharWidth));
  const words = text.replace(/\r\n/g, '\n').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!word) continue;
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxChars) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxChars) {
        let remaining = word;
        while (remaining.length > maxChars) {
          lines.push(remaining.slice(0, maxChars));
          remaining = remaining.slice(maxChars);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

export function generateStudentAnswerKeyPdf(data: StudentAnswerKeyReportData): Buffer {
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 523.28
  const BOTTOM_LIMIT = 50; // Leave space for footer line and text

  const pages: string[] = [];
  let currentOps: string[] = [];
  let currentY = PAGE_HEIGHT - MARGIN;

  function newPage() {
    if (currentOps.length > 0) {
      pages.push(currentOps.join('\n'));
      currentOps = [];
    }
    currentY = PAGE_HEIGHT - MARGIN;
  }

  // Draw rectangle
  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill?: [number, number, number],
    stroke?: [number, number, number],
    lineWidth = 1
  ) {
    let op = `q\n`;
    if (lineWidth !== 1) op += `${lineWidth.toFixed(2)} w\n`;
    if (fill) op += `${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg\n`;
    if (stroke) op += `${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG\n`;
    op += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`;
    if (fill && stroke) op += `B\n`;
    else if (fill) op += `f\n`;
    else if (stroke) op += `S\n`;
    op += `Q\n`;
    currentOps.push(op);
  }

  // Draw line
  function line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: [number, number, number] = [0.8, 0.8, 0.8],
    lineWidth = 1
  ) {
    let op = `q\n`;
    if (lineWidth !== 1) op += `${lineWidth.toFixed(2)} w\n`;
    op += `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG\n`;
    op += `${x1.toFixed(2)} ${y1.toFixed(2)} m\n${x2.toFixed(2)} ${y2.toFixed(2)} l\nS\nQ\n`;
    currentOps.push(op);
  }

  // Draw text
  function text(
    str: string | number,
    x: number,
    y: number,
    fontSize = 9,
    font: 'F1' | 'F2' = 'F1', // F1 = Regular, F2 = Bold
    color: [number, number, number] = [0, 0, 0],
    align: 'left' | 'center' | 'right' = 'left',
    width?: number
  ) {
    const escaped = escapePdfText(str);
    let posX = x;
    const approxCharWidth = fontSize * (font === 'F2' ? 0.55 : 0.51);
    const textWidth = escaped.length * approxCharWidth;

    if (align === 'center' && width) {
      posX = x + (width - textWidth) / 2;
    } else if (align === 'right' && width) {
      posX = x + width - textWidth;
    }

    const op = `BT\n/${font} ${fontSize} Tf\n${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg\n1 0 0 1 ${posX.toFixed(2)} ${y.toFixed(2)} Tm\n(${escaped}) Tj\nET\n`;
    currentOps.push(op);
  }

  // Draw Header: Crack Academy ONLY on First Page
  function drawHeader(isFirstPage: boolean) {
    if (isFirstPage) {
      // 1. Top Banner (Crack Academy exclusively on Page 1)
      rect(MARGIN, currentY - 52, CONTENT_WIDTH, 52, [0.08, 0.22, 0.45]); // Deep Royal Navy
      text(data.instituteName || 'Crack Academy', MARGIN + 14, currentY - 22, 16, 'F2', [1, 1, 1]);
      text('CANDIDATE EXAMINATION ANSWER KEY & PERFORMANCE REPORT', MARGIN + 14, currentY - 40, 8.5, 'F1', [0.82, 0.9, 1]);

      // Badge on top right
      const scoreBadgeText = `SCORE: ${data.score} / ${data.totalMarks}`;
      rect(PAGE_WIDTH - MARGIN - 145, currentY - 40, 132, 28, [0.06, 0.42, 0.18]); // Emerald Green
      text(scoreBadgeText, PAGE_WIDTH - MARGIN - 145, currentY - 23, 9.5, 'F2', [1, 1, 1], 'center', 132);

      currentY -= 64;

      // 2. Candidate & Exam Meta Box
      rect(MARGIN, currentY - 46, CONTENT_WIDTH, 46, [0.97, 0.98, 1], [0.8, 0.86, 0.94], 1);
      text(`CANDIDATE: ${data.studentName.toUpperCase()} (Roll No: ${data.rollNo})`, MARGIN + 12, currentY - 17, 9.5, 'F2', [0.08, 0.22, 0.45]);
      text(`EXAM: ${data.examTitle}`, MARGIN + 12, currentY - 33, 9, 'F2', [0.2, 0.2, 0.2]);

      text(`Submitted: ${data.submittedAt}`, MARGIN + 295, currentY - 17, 8, 'F1', [0.45, 0.48, 0.52]);
      text(`Duration: ${data.examDuration} Mins | Negative Penalty: -${data.negativeMarks} Marks`, MARGIN + 295, currentY - 33, 8, 'F1', [0.45, 0.48, 0.52]);

      currentY -= 54;

      // 3. Mini Score Metrics Row (4 Cards)
      const cardGap = 8;
      const cardW = (CONTENT_WIDTH - cardGap * 3) / 4;
      const cardH = 34;

      // Total Score
      rect(MARGIN, currentY - cardH, cardW, cardH, [0.93, 0.96, 1], [0.78, 0.85, 0.98]);
      text('FINAL SCORE', MARGIN + 8, currentY - 12, 7, 'F2', [0.2, 0.35, 0.65]);
      text(`${data.score} / ${data.totalMarks}`, MARGIN + 8, currentY - 26, 10.5, 'F2', [0.08, 0.22, 0.45]);

      // Correct
      rect(MARGIN + (cardW + cardGap), currentY - cardH, cardW, cardH, [0.92, 0.98, 0.94], [0.7, 0.9, 0.75]);
      text('CORRECT (✓)', MARGIN + (cardW + cardGap) + 8, currentY - 12, 7, 'F2', [0.08, 0.5, 0.18]);
      text(`${data.correctCount} Questions`, MARGIN + (cardW + cardGap) + 8, currentY - 26, 10.5, 'F2', [0.08, 0.5, 0.18]);

      // Incorrect
      rect(MARGIN + (cardW + cardGap) * 2, currentY - cardH, cardW, cardH, [1, 0.94, 0.94], [0.95, 0.75, 0.75]);
      text('INCORRECT (✗)', MARGIN + (cardW + cardGap) * 2 + 8, currentY - 12, 7, 'F2', [0.78, 0.15, 0.15]);
      text(`${data.incorrectCount} Questions`, MARGIN + (cardW + cardGap) * 2 + 8, currentY - 26, 10.5, 'F2', [0.78, 0.15, 0.15]);

      // Skipped
      rect(MARGIN + (cardW + cardGap) * 3, currentY - cardH, cardW, cardH, [0.98, 0.97, 0.94], [0.88, 0.85, 0.75]);
      text('SKIPPED (—)', MARGIN + (cardW + cardGap) * 3 + 8, currentY - 12, 7, 'F2', [0.55, 0.42, 0.05]);
      text(`${data.unansweredCount} Questions`, MARGIN + (cardW + cardGap) * 3 + 8, currentY - 26, 10.5, 'F2', [0.55, 0.42, 0.05]);

      currentY -= 44;

      // Section label banner
      rect(MARGIN, currentY - 18, CONTENT_WIDTH, 18, [0.12, 0.24, 0.48]);
      text('QUESTION WISE DETAILED SOLUTIONS & CANDIDATE RESPONSES', MARGIN + 8, currentY - 13, 7.5, 'F2', [1, 1, 1]);
      currentY -= 26;
    } else {
      // Pages 2 and later: NO Crack Academy header! Only subtle running exam header
      line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY, [0.8, 0.83, 0.88], 0.75);
      text(`${data.examTitle} — Candidate: ${data.studentName} (${data.rollNo})`, MARGIN, currentY - 12, 7.5, 'F1', [0.45, 0.48, 0.52]);
      text('Detailed Solutions Sheet', PAGE_WIDTH - MARGIN - 120, currentY - 12, 7.5, 'F2', [0.35, 0.38, 0.42], 'right', 120);
      currentY -= 22;
    }
  }

  // Draw First Page Header
  drawHeader(true);

  // Render Questions
  for (const q of data.questions) {
    // 1. Calculate question height
    // Question text wrapped lines (each line is 12pt)
    const textLines = wrapText(q.text, CONTENT_WIDTH - 20, 8.5, false);
    const textBlockHeight = textLines.length * 12;

    // Header line: 15pt
    // Text block: textBlockHeight
    // Correct answer line: 14pt
    // Your answer line: 14pt
    // Divider spacing: 14pt
    const questionCardHeight = 15 + textBlockHeight + 14 + 14 + 14;

    // Check page break
    if (currentY - questionCardHeight < BOTTOM_LIMIT) {
      newPage();
      drawHeader(false); // Page 2+ header (no Crack Academy)
    }

    // 2. Render Question Header
    // Section badge + Question Number
    const qHeader = `Q${q.number}. [${q.section}]`;
    text(qHeader, MARGIN + 4, currentY - 10, 9, 'F2', [0.08, 0.22, 0.45]);

    const marksLabel = `Marks: +${q.marks} | Neg: -${data.negativeMarks}`;
    text(marksLabel, PAGE_WIDTH - MARGIN - 110, currentY - 10, 7.5, 'F1', [0.45, 0.48, 0.52], 'right', 106);

    currentY -= 16;

    // 3. Render Question Text (Wrapped lines)
    for (const lineText of textLines) {
      text(lineText, MARGIN + 12, currentY - 9, 8.5, 'F1', [0.15, 0.15, 0.15]);
      currentY -= 12;
    }

    currentY -= 4;

    // 4. Render Correct Answer Line (Green)
    const corTextClean = q.correctOptionText ? ` (${q.correctOptionText})` : '';
    const corLine = `* Correct Answer : Option ${q.correctOption}${corTextClean}`;
    text(corLine, MARGIN + 14, currentY - 9, 8.5, 'F2', [0.08, 0.5, 0.18]);

    currentY -= 14;

    // 5. Render Student's Answer Line (with status badge & marks impact)
    if (q.status === 'CORRECT') {
      const stuTextClean = q.selectedOptionText ? ` (${q.selectedOptionText})` : '';
      const stuLine = `* Your Answer    : Option ${q.selectedOption}${stuTextClean}   [Correct (/) | +${q.marksEarned.toFixed(1)} Marks]`;
      text(stuLine, MARGIN + 14, currentY - 9, 8.5, 'F2', [0.08, 0.5, 0.18]);
    } else if (q.status === 'INCORRECT') {
      const stuTextClean = q.selectedOptionText ? ` (${q.selectedOptionText})` : '';
      const marksStr = q.marksEarned < 0 ? q.marksEarned.toFixed(1) : `-${q.marksEarned.toFixed(1)}`;
      const stuLine = `* Your Answer    : Option ${q.selectedOption}${stuTextClean}   [Incorrect (X) | ${marksStr} Marks]`;
      text(stuLine, MARGIN + 14, currentY - 9, 8.5, 'F2', [0.78, 0.15, 0.15]);
    } else {
      const stuLine = `* Your Answer    : Not Attempted   [Skipped (-) | 0.0 Marks]`;
      text(stuLine, MARGIN + 14, currentY - 9, 8.5, 'F2', [0.5, 0.45, 0.1]);
    }

    currentY -= 14;

    // Divider line between questions
    line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY, [0.88, 0.9, 0.93], 0.5);
    currentY -= 10;
  }

  // Push final page
  if (currentOps.length > 0) {
    pages.push(currentOps.join('\n'));
    currentOps = [];
  }

  // Assemble Final Pages with Footers
  const totalPages = pages.length;
  const finalizedStreams: string[] = [];

  for (let p = 0; p < totalPages; p++) {
    let stream = pages[p];
    const footerY = MARGIN + 6;

    // Running footer divider line
    const footerLine = `q\n0.5 w\n0.82 0.85 0.89 RG\n${MARGIN.toFixed(2)} ${(footerY + 14).toFixed(
      2
    )} m\n${(PAGE_WIDTH - MARGIN).toFixed(2)} ${(footerY + 14).toFixed(2)} l\nS\nQ\n`;

    // Creator Attribution on ALL PAGES: "PDF created by Sudarshan Mishra"
    const footerText = `BT\n/F2 8 Tf\n0.2 0.25 0.32 rg\n1 0 0 1 ${MARGIN.toFixed(2)} ${footerY.toFixed(
      2
    )} Tm\n(PDF created by Sudarshan Mishra) Tj\nET\n`;

    // Page Number
    const pageNumStr = `Page ${p + 1} of ${totalPages}`;
    const pageNumEscaped = escapePdfText(pageNumStr);
    const pageNumX = PAGE_WIDTH - MARGIN - 65;
    const pageNumOp = `BT\n/F1 8 Tf\n0.4 0.44 0.48 rg\n1 0 0 1 ${pageNumX.toFixed(2)} ${footerY.toFixed(
      2
    )} Tm\n(${pageNumEscaped}) Tj\nET\n`;

    stream += `\n${footerLine}${footerText}${pageNumOp}`;
    finalizedStreams.push(stream);
  }

  // Construct PDF Objects
  let nextObjIndex = 5;
  const pageObjIndices: number[] = [];
  const pageDefs: { pageIndex: number; contentIndex: number; stream: string }[] = [];

  for (let p = 0; p < totalPages; p++) {
    const pageObjIdx = nextObjIndex++;
    const contentObjIdx = nextObjIndex++;
    pageObjIndices.push(pageObjIdx);
    pageDefs.push({
      pageIndex: pageObjIdx,
      contentIndex: contentObjIdx,
      stream: finalizedStreams[p],
    });
  }

  const pagesObj = `<< /Type /Pages /Kids [${pageObjIndices.map((i) => `${i} 0 R`).join(' ')}] /Count ${totalPages} >>`;

  const allObjects: { id: number; body: string }[] = [
    { id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` },
    { id: 2, body: pagesObj },
    { id: 3, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>` },
    { id: 4, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>` },
  ];

  for (const pd of pageDefs) {
    const pageObjBody = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
      2
    )}] /Contents ${pd.contentIndex} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    const streamBuffer = Buffer.from(pd.stream, 'utf-8');
    const contentObjBody = `<< /Length ${streamBuffer.length} >>\nstream\n${pd.stream}\nendstream`;
    allObjects.push({ id: pd.pageIndex, body: pageObjBody });
    allObjects.push({ id: pd.contentIndex, body: contentObjBody });
  }

  allObjects.sort((a, b) => a.id - b.id);

  // Serialize to PDF binary buffer
  const pdfHeader = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const offsets: number[] = [];
  let currentOffset = Buffer.byteLength(pdfHeader, 'binary');

  const objBuffers: Buffer[] = [Buffer.from(pdfHeader, 'binary')];

  for (const obj of allObjects) {
    offsets[obj.id] = currentOffset;
    const objHeader = `${obj.id} 0 obj\n`;
    const objFooter = `\nendobj\n`;
    const chunk = Buffer.concat([
      Buffer.from(objHeader, 'binary'),
      Buffer.from(obj.body, 'binary'),
      Buffer.from(objFooter, 'binary'),
    ]);
    objBuffers.push(chunk);
    currentOffset += chunk.length;
  }

  const startXref = currentOffset;
  let xref = `xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= allObjects.length; i++) {
    const off = String(offsets[i]).padStart(10, '0');
    xref += `${off} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;
  objBuffers.push(Buffer.from(xref + trailer, 'binary'));

  return Buffer.concat(objBuffers);
}
