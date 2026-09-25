/**
 * Zero-dependency standards-compliant PDF 1.4 Generator for CBT Exam Reports
 * Generates vector A4 PDF reports with student rankings, marks, correct, wrong & skipped counts.
 */

export interface StudentResultRow {
  rank: number | string;
  rollNo: string;
  name: string;
  isSubmitted: boolean;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number; // Skipped
  percentage: number;
  submittedAt?: string;
}

export interface BatchExamReportData {
  instituteName?: string;
  batchName: string;
  examTitle: string;
  examDuration: number;
  totalMarks: number;
  negativeMarks: number;
  questionCount: number;
  generatedAt: string;
  stats: {
    totalEnrolled: number;
    totalSubmitted: number;
    totalPending: number;
    isAllSubmitted: boolean;
    classAverage: number;
    highestScore: number;
    lowestScore: number;
    topperName?: string;
    topperRoll?: string;
  };
  students: StudentResultRow[];
}

function escapePdfText(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, ' '); // Clean printable ASCII
}

export function generateBatchExamPdfReport(data: BatchExamReportData): Buffer {
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 523.28

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

  // Draw text
  function text(
    str: string | number,
    x: number,
    y: number,
    fontSize = 9,
    font: 'F1' | 'F2' | 'F3' = 'F1', // F1 = Regular, F2 = Bold, F3 = Oblique
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

  // Header Component
  function drawHeader(isFirstPage: boolean) {
    // Top banner
    rect(MARGIN, currentY - 52, CONTENT_WIDTH, 52, [0.08, 0.21, 0.45]); // Deep Royal Navy

    // Institute & Title
    text(data.instituteName || 'CBT EXAMINATION PORTAL', MARGIN + 14, currentY - 20, 13, 'F2', [1, 1, 1]);
    text('OFFICIAL BATCH MARKS & PERFORMANCE REPORT', MARGIN + 14, currentY - 37, 9.5, 'F1', [0.82, 0.89, 1]);

    // Status Badge inside header
    const isComplete = data.stats.isAllSubmitted;
    const badgeText = isComplete
      ? 'ALL SUBMITTED (100%)'
      : `${data.stats.totalSubmitted}/${data.stats.totalEnrolled} SUBMITTED`;
    const badgeBg: [number, number, number] = isComplete ? [0.12, 0.55, 0.24] : [0.85, 0.48, 0.05];

    rect(PAGE_WIDTH - MARGIN - 155, currentY - 39, 142, 26, badgeBg);
    text(badgeText, PAGE_WIDTH - MARGIN - 155, currentY - 26, 8.5, 'F2', [1, 1, 1], 'center', 142);

    currentY -= 64;

    if (isFirstPage) {
      // Exam & Batch Details Card
      rect(MARGIN, currentY - 56, CONTENT_WIDTH, 56, [0.96, 0.98, 1], [0.78, 0.85, 0.94], 1);

      // Left Column
      text(`BATCH: ${data.batchName.toUpperCase()}`, MARGIN + 14, currentY - 18, 10, 'F2', [0.08, 0.21, 0.45]);
      text(`EXAM: ${data.examTitle}`, MARGIN + 14, currentY - 33, 9.5, 'F2', [0.15, 0.15, 0.15]);
      text(
        `Duration: ${data.examDuration} Mins  |  Total Marks: ${data.totalMarks}  |  Negative Marking: -${data.negativeMarks}`,
        MARGIN + 14,
        currentY - 47,
        8,
        'F1',
        [0.4, 0.45, 0.5]
      );

      // Right Column
      text(`Report Date: ${data.generatedAt}`, MARGIN + 295, currentY - 18, 8, 'F1', [0.4, 0.45, 0.5]);
      text(
        `Enrolled: ${data.stats.totalEnrolled}  |  Submitted: ${data.stats.totalSubmitted}  |  Pending: ${data.stats.totalPending}`,
        MARGIN + 295,
        currentY - 32,
        8.5,
        'F2',
        [0.1, 0.5, 0.2]
      );
      if (data.stats.topperName) {
        text(
          `Batch Topper (Rank 1): ${data.stats.topperName} (${data.stats.highestScore} Marks)`,
          MARGIN + 295,
          currentY - 47,
          8.5,
          'F2',
          [0.75, 0.45, 0.05]
        );
      }

      currentY -= 68;

      // 4 Summary Metrics Cards
      const cardGap = 8;
      const cardW = (CONTENT_WIDTH - cardGap * 3) / 4;
      const cardH = 38;

      // Card 1: Total Enrolled
      rect(MARGIN, currentY - cardH, cardW, cardH, [0.93, 0.96, 1], [0.78, 0.85, 0.98]);
      text('TOTAL ENROLLED', MARGIN + 8, currentY - 13, 7, 'F2', [0.2, 0.35, 0.65]);
      text(`${data.stats.totalEnrolled} Students`, MARGIN + 8, currentY - 29, 11, 'F2', [0.08, 0.21, 0.45]);

      // Card 2: Submissions
      rect(MARGIN + (cardW + cardGap), currentY - cardH, cardW, cardH, [0.92, 0.98, 0.94], [0.7, 0.9, 0.75]);
      text('SUBMISSIONS', MARGIN + (cardW + cardGap) + 8, currentY - 13, 7, 'F2', [0.1, 0.52, 0.22]);
      text(`${data.stats.totalSubmitted} of ${data.stats.totalEnrolled}`, MARGIN + (cardW + cardGap) + 8, currentY - 29, 11, 'F2', [0.1, 0.52, 0.22]);

      // Card 3: Class Average
      rect(MARGIN + (cardW + cardGap) * 2, currentY - cardH, cardW, cardH, [1, 0.96, 0.91], [0.95, 0.82, 0.65]);
      text('CLASS AVERAGE', MARGIN + (cardW + cardGap) * 2 + 8, currentY - 13, 7, 'F2', [0.72, 0.4, 0.05]);
      text(`${data.stats.classAverage.toFixed(1)} / ${data.totalMarks}`, MARGIN + (cardW + cardGap) * 2 + 8, currentY - 29, 11, 'F2', [0.72, 0.4, 0.05]);

      // Card 4: Highest Mark
      rect(MARGIN + (cardW + cardGap) * 3, currentY - cardH, cardW, cardH, [0.96, 0.93, 1], [0.85, 0.75, 0.98]);
      text('HIGHEST SCORE', MARGIN + (cardW + cardGap) * 3 + 8, currentY - 13, 7, 'F2', [0.45, 0.2, 0.68]);
      text(`${data.stats.highestScore} Marks`, MARGIN + (cardW + cardGap) * 3 + 8, currentY - 29, 11, 'F2', [0.45, 0.2, 0.68]);

      currentY -= 48;
    }
  }

  // Column definitions
  // Total width: 523.28
  const cols = [
    { key: 'rank', label: 'Rank', width: 44, align: 'center' as const },
    { key: 'rollNo', label: 'Roll No', width: 78, align: 'left' as const },
    { key: 'name', label: 'Student Name', width: 114, align: 'left' as const },
    { key: 'status', label: 'Status', width: 54, align: 'center' as const },
    { key: 'score', label: 'Score', width: 52, align: 'right' as const },
    { key: 'correct', label: 'Correct', width: 44, align: 'right' as const },
    { key: 'wrong', label: 'Wrong', width: 44, align: 'right' as const },
    { key: 'skipped', label: 'Skipped', width: 46, align: 'right' as const },
    { key: 'percent', label: '% Marks', width: 47, align: 'right' as const },
  ];

  function drawTableHeader() {
    rect(MARGIN, currentY - 22, CONTENT_WIDTH, 22, [0.12, 0.24, 0.48]); // Header dark blue
    let curX = MARGIN;
    for (const c of cols) {
      text(c.label, curX + 3, currentY - 15, 8, 'F2', [1, 1, 1], c.align, c.width - 6);
      curX += c.width;
    }
    currentY -= 22;
  }

  // Build first page
  drawHeader(true);
  drawTableHeader();

  // Print Student Rows
  const ROW_HEIGHT = 18;
  const BOTTOM_LIMIT = 54; // Space for guidance or footer

  for (let i = 0; i < data.students.length; i++) {
    const s = data.students[i];

    // Check if new page is needed
    if (currentY - ROW_HEIGHT < BOTTOM_LIMIT) {
      newPage();
      drawHeader(false);
      drawTableHeader();
    }

    // Row Background (Alternating)
    const isEven = i % 2 === 0;
    const bg: [number, number, number] = isEven ? [0.97, 0.98, 0.99] : [1, 1, 1];
    rect(MARGIN, currentY - ROW_HEIGHT, CONTENT_WIDTH, ROW_HEIGHT, bg, [0.88, 0.9, 0.94], 0.4);

    let curX = MARGIN;

    // 1. Rank
    const rankStr = s.isSubmitted ? (typeof s.rank === 'number' ? `#${s.rank}` : String(s.rank)) : '—';
    const rankColor: [number, number, number] =
      s.rank === 1
        ? [0.75, 0.45, 0.05]
        : s.rank === 2 || s.rank === 3
        ? [0.1, 0.35, 0.65]
        : [0.35, 0.35, 0.35];
    text(rankStr, curX + 2, currentY - 13, 8, s.rank === 1 ? 'F2' : 'F1', rankColor, 'center', cols[0].width - 4);
    curX += cols[0].width;

    // 2. Roll No
    text(s.rollNo, curX + 3, currentY - 13, 8, 'F2', [0.1, 0.1, 0.1], 'left', cols[1].width - 6);
    curX += cols[1].width;

    // 3. Name (truncated if too long)
    const displayName = s.name.length > 20 ? s.name.slice(0, 19) + '…' : s.name;
    text(displayName, curX + 3, currentY - 13, 8, 'F1', [0.12, 0.12, 0.12], 'left', cols[2].width - 6);
    curX += cols[2].width;

    // 4. Status
    const statusLabel = s.isSubmitted ? 'SUBMITTED' : 'PENDING';
    const statusColor: [number, number, number] = s.isSubmitted ? [0.1, 0.55, 0.2] : [0.75, 0.2, 0.2];
    text(statusLabel, curX + 2, currentY - 13, 7, 'F2', statusColor, 'center', cols[3].width - 4);
    curX += cols[3].width;

    // 5. Score
    const scoreStr = s.isSubmitted ? `${s.score}` : '—';
    text(scoreStr, curX + 2, currentY - 13, 8, 'F2', [0.08, 0.21, 0.45], 'right', cols[4].width - 6);
    curX += cols[4].width;

    // 6. Correct
    const corStr = s.isSubmitted ? `${s.correctCount}` : '—';
    text(corStr, curX + 2, currentY - 13, 8, 'F1', [0.1, 0.55, 0.2], 'right', cols[5].width - 6);
    curX += cols[5].width;

    // 7. Wrong
    const wrgStr = s.isSubmitted ? `${s.incorrectCount}` : '—';
    text(wrgStr, curX + 2, currentY - 13, 8, 'F1', [0.75, 0.2, 0.2], 'right', cols[6].width - 6);
    curX += cols[6].width;

    // 8. Skipped
    const skpStr = s.isSubmitted ? `${s.unansweredCount}` : '—';
    text(skpStr, curX + 2, currentY - 13, 8, 'F1', [0.55, 0.42, 0.05], 'right', cols[7].width - 6);
    curX += cols[7].width;

    // 9. Percentage
    const pctStr = s.isSubmitted ? `${s.percentage.toFixed(1)}%` : '—';
    text(pctStr, curX + 2, currentY - 13, 8, 'F1', [0.2, 0.2, 0.2], 'right', cols[8].width - 6);
    curX += cols[8].width;

    currentY -= ROW_HEIGHT;
  }

  // Guidance Notes for Admin & Teachers
  if (currentY - 50 < BOTTOM_LIMIT) {
    newPage();
    drawHeader(false);
  }

  currentY -= 14;
  rect(MARGIN, currentY - 42, CONTENT_WIDTH, 42, [0.97, 0.98, 1], [0.8, 0.86, 0.95], 0.8);
  text('ADMIN & FACULTY GUIDANCE DIRECTIVES:', MARGIN + 10, currentY - 14, 8, 'F2', [0.12, 0.24, 0.48]);
  text(
    '- High "Wrong" Count: Counsel students on negative-marking reduction, precision reading, and avoiding wild guesses.',
    MARGIN + 10,
    currentY - 26,
    7.5,
    'F1',
    [0.3, 0.35, 0.4]
  );
  text(
    '- High "Skipped" Count: Conduct speed drills, time allocation tests, and foundational chapter revisions.',
    MARGIN + 10,
    currentY - 36,
    7.5,
    'F1',
    [0.3, 0.35, 0.4]
  );

  // Close final page
  newPage();

  // Add standard running footers ("Page X of Total", system stamp)
  const totalPages = pages.length;
  const finalizedStreams: string[] = [];

  for (let p = 0; p < totalPages; p++) {
    let stream = pages[p];
    const footerY = 22;

    // Footer divider line
    const footerLine = `q\n0.5 w\n0.8 0.82 0.86 RG\n${MARGIN.toFixed(2)} ${(footerY + 12).toFixed(2)} m ${(
      PAGE_WIDTH - MARGIN
    ).toFixed(2)} ${(footerY + 12).toFixed(2)} l\nS\nQ\n`;

    // System tag
    const footerText = `BT\n/F1 7.5 Tf\n0.45 0.48 0.52 rg\n1 0 0 1 ${MARGIN.toFixed(2)} ${footerY.toFixed(
      2
    )} Tm\n(CBT Examination Software - Batch Performance & Marks Report - Confidential) Tj\nET\n`;

    // Page number
    const pageNumStr = `Page ${p + 1} of ${totalPages}`;
    const pageNumEscaped = escapePdfText(pageNumStr);
    const pageNumX = PAGE_WIDTH - MARGIN - 65;
    const pageNumOp = `BT\n/F2 7.5 Tf\n0.35 0.38 0.42 rg\n1 0 0 1 ${pageNumX.toFixed(2)} ${footerY.toFixed(
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

  // Sort objects by id
  allObjects.sort((a, b) => a.id - b.id);

  // Serialize to PDF Buffer
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
