"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface ExtractedQuestion {
  id?: string;
  selected: boolean;
  section: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  marks: number;
}

export default function AdminExamPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const examId = unwrappedParams.id;

  const [exam, setExam] = useState<any>(null);

  // Manual Question Form State
  const [section, setSection] = useState("General Intelligence");
  const [text, setText] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState("A");
  const [marks, setMarks] = useState("2");
  const [addingSingle, setAddingSingle] = useState(false);

  // PDF Import Modal State
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [defaultImportSection, setDefaultImportSection] = useState("General Intelligence");
  const [defaultImportMarks, setDefaultImportMarks] = useState("2");
  const [customApiKey, setCustomApiKey] = useState("");
  const [hasServerKey, setHasServerKey] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [extractionWarning, setExtractionWarning] = useState("");

  // Extracted Questions Preview State
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [previewStep, setPreviewStep] = useState<"UPLOAD" | "PREVIEW">("UPLOAD");
  const [importingBulk, setImportingBulk] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState("");

  const fetchExam = async () => {
    const res = await fetch(`/api/exam/${examId}`);
    if (res.ok) {
      const data = await res.json();
      setExam(data.exam || data);
    }
  };

  const checkAiStatus = async () => {
    try {
      const res = await fetch("/api/admin/ai-status");
      if (res.ok) {
        const data = await res.json();
        setHasServerKey(Boolean(data.hasServerGeminiKey));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchExam();
    checkAiStatus();
  }, [examId]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSingle(true);
    try {
      const res = await fetch("/api/admin/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          section,
          text,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
          marks,
        }),
      });
      if (res.ok) {
        alert("Question Added!");
        setText("");
        setOptionA("");
        setOptionB("");
        setOptionC("");
        setOptionD("");
        fetchExam();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add question");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding question");
    } finally {
      setAddingSingle(false);
    }
  };

  // -------------------------------------------------------------
  // PDF Extraction Flow
  // -------------------------------------------------------------
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      setExtractionError("Please select a PDF file to import.");
      return;
    }

    setIsExtracting(true);
    setExtractionError("");
    setExtractionWarning("");

    try {
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("defaultSection", defaultImportSection);
      formData.append("defaultMarks", defaultImportMarks);
      if (customApiKey.trim()) {
        formData.append("apiKey", customApiKey.trim());
      }

      const res = await fetch(`/api/admin/exam/${examId}/import-pdf`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setExtractionError(data.error || "Failed to extract questions from PDF");
        return;
      }

      if (data.warning) {
        setExtractionWarning(data.warning);
      }

      const parsedWithSelection = (data.questions || []).map((q: any, idx: number) => ({
        ...q,
        id: `parsed-${idx}-${Date.now()}`,
        selected: true,
      }));

      setExtractedQuestions(parsedWithSelection);
      setPreviewStep("PREVIEW");
    } catch (err: any) {
      console.error(err);
      setExtractionError("Network error while communicating with import service.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Update a single extracted question field
  const handleUpdateExtracted = (index: number, field: keyof ExtractedQuestion, value: any) => {
    setExtractedQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Toggle selection
  const handleToggleSelectAll = (selectAll: boolean) => {
    setExtractedQuestions((prev) =>
      prev.map((q) => ({ ...q, selected: selectAll }))
    );
  };

  // Delete question from preview list
  const handleDeleteExtracted = (index: number) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // Bulk Commit to Database
  // -------------------------------------------------------------
  const handleConfirmImport = async () => {
    const selected = extractedQuestions.filter((q) => q.selected);
    if (selected.length === 0) {
      alert("Please select at least one question to import.");
      return;
    }

    setImportingBulk(true);
    try {
      const res = await fetch("/api/admin/question/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          questions: selected,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setImportSuccessMsg(`🎉 Successfully imported ${data.count} questions into this exam!`);
        setTimeout(() => {
          setShowPdfModal(false);
          setPreviewStep("UPLOAD");
          setPdfFile(null);
          setExtractedQuestions([]);
          setImportSuccessMsg("");
          fetchExam();
        }, 1500);
      } else {
        alert(data.error || "Failed to import questions");
      }
    } catch (err) {
      console.error(err);
      alert("Network error importing questions");
    } finally {
      setImportingBulk(false);
    }
  };

  if (!exam) return <div className="p-8 font-semibold text-gray-500">Loading exam details...</div>;

  const selectedCount = extractedQuestions.filter((q) => q.selected).length;

  return (
    <div className="flex-1 bg-gray-100 p-8 text-black font-sans">
      <div className="max-w-6xl mx-auto flex gap-6">

        {/* Left: Add Question Form */}
        <div className="flex-1 bg-white p-6 rounded shadow-md">
          <div className="mb-4 flex flex-wrap justify-between items-center gap-3 border-b pb-4">
            <div>
              <Link href="/admin" className="text-blue-600 hover:underline text-sm block mb-1">
                ← Back to Dashboard
              </Link>
              <h2 className="text-2xl font-bold text-blue-900">
                Manage Questions: <span className="text-gray-700">{exam.title}</span>
              </h2>
            </div>
            {/* Import from PDF Button */}
            <button
              onClick={() => {
                setPreviewStep("UPLOAD");
                setExtractionError("");
                setExtractionWarning("");
                setShowPdfModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg shadow flex items-center gap-2 text-sm transition-all transform hover:scale-[1.02]"
            >
              📄 Import from PDF
            </button>
          </div>

          <h3 className="font-bold text-base text-gray-800 mb-3">Add Single Question Manually</h3>

          <form onSubmit={handleAddQuestion}>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-700">Section Name</label>
              <input
                required
                type="text"
                className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g., Quantitative Aptitude or ਪੰਜਾਬੀ ਵਿਆਕਰਨ"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold mb-1 text-gray-700">Question Text</label>
              <textarea
                required
                className="w-full border p-2.5 rounded h-32 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter question text in English, Hindi, or Punjabi..."
              ></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Option A</label>
                <input
                  required
                  type="text"
                  className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Option B</label>
                <input
                  required
                  type="text"
                  className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Option C</label>
                <input
                  required
                  type="text"
                  className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={optionC}
                  onChange={(e) => setOptionC(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1 text-gray-700">Option D</label>
                <input
                  required
                  type="text"
                  className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={optionD}
                  onChange={(e) => setOptionD(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-sm font-bold mb-1 text-gray-700">Correct Option</label>
                <select
                  className="w-full border p-2.5 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={correctOption}
                  onChange={(e) => setCorrectOption(e.target.value)}
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold mb-1 text-gray-700">Marks</label>
                <input
                  required
                  type="number"
                  className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingSingle}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow"
            >
              {addingSingle ? "Saving..." : "+ Add Question"}
            </button>
          </form>
        </div>

        {/* Right: Existing Questions List */}
        <div
          className="w-96 bg-white p-6 rounded shadow-md overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 4rem)" }}
        >
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-xl font-bold text-gray-900">
              Questions <span className="text-blue-600 font-semibold">({exam.questions?.length || 0})</span>
            </h3>
          </div>

          <div className="flex flex-col gap-4">
            {exam.questions?.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                No questions yet. Add one manually or click &quot;Import from PDF&quot;!
              </div>
            )}
            {exam.questions?.map((q: any, i: number) => (
              <div key={q.id} className="border p-3.5 rounded-lg bg-gray-50 text-sm shadow-sm hover:border-gray-300 transition-colors">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Q{i + 1} | {q.section}
                  </span>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete Question ${i + 1}? This cannot be undone.`)) return;
                      await fetch(`/api/admin/question/${q.id}`, { method: "DELETE" });
                      fetchExam();
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-bold ml-2 p-1 hover:bg-red-50 rounded"
                    title="Delete this question"
                  >
                    🗑️ Delete
                  </button>
                </div>
                <div className="mb-2.5 font-medium text-gray-900 leading-snug">{q.text}</div>
                <div className="text-gray-600 text-xs space-y-1 bg-white p-2 rounded border">
                  <div><b>A:</b> {q.optionA}</div>
                  <div><b>B:</b> {q.optionB}</div>
                  <div><b>C:</b> {q.optionC}</div>
                  <div><b>D:</b> {q.optionD}</div>
                </div>
                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✅ Correct: {q.correctOption || "A"}
                  </span>
                  <span className="text-gray-500 font-semibold">Marks: {q.marks}</span>
                </div>
                {q.addedBy && (
                  <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1 border-t pt-1">
                    👤 Added by: <span className="font-medium text-gray-700">{q.addedBy}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL: PDF IMPORT & INTERACTIVE PREVIEW                                   */}
      {/* ========================================================================= */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 animate-fade-in">

            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <span>📄</span>
                  {previewStep === "UPLOAD" ? "Import Exam Questions from PDF" : "Review & Edit Extracted Questions"}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  {previewStep === "UPLOAD"
                    ? "Upload any question paper PDF (supports English, Hindi, Punjabi Gurmukhi, and answer keys)."
                    : `Verify extracted questions before importing into "${exam.title}".`}
                </p>
              </div>
              <button
                onClick={() => setShowPdfModal(false)}
                className="text-white/80 hover:text-white text-xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {/* Feedback Notifications */}
            {importSuccessMsg && (
              <div className="p-4 bg-emerald-100 text-emerald-800 font-bold text-center border-b">
                {importSuccessMsg}
              </div>
            )}
            {extractionWarning && (
              <div className="px-6 py-2 bg-amber-50 text-amber-800 text-xs border-b">
                ⚠️ {extractionWarning}
              </div>
            )}

            {/* Step 1: Upload Form */}
            {previewStep === "UPLOAD" && (
              <form onSubmit={handlePdfUpload} className="p-6 overflow-y-auto flex-1 space-y-5">
                {extractionError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {extractionError}
                  </div>
                )}

                {/* Engine Status Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs flex items-center justify-between text-blue-900">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>
                      {hasServerKey
                        ? "AI Extraction Active (Gemini 2.5 Flash with Punjabi Gurmukhi & Hindi support)"
                        : "Smart Extraction Active (Local parser + Optional Gemini AI)"}
                    </span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-medium">Auto-detects Option A-D & Answer Keys</span>
                </div>

                {/* PDF File Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Select Exam PDF File *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 text-center bg-gray-50 hover:bg-blue-50/50 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      required
                      accept=".pdf,application/pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-3xl mb-2">📥</div>
                    {pdfFile ? (
                      <div>
                        <p className="font-bold text-blue-900 text-sm">{pdfFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB PDF selected
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-gray-700 text-sm">
                          Click to browse or drag and drop your question paper PDF here
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Supports up to 50MB PDF papers</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Default Section Name
                    </label>
                    <input
                      type="text"
                      className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={defaultImportSection}
                      onChange={(e) => setDefaultImportSection(e.target.value)}
                      placeholder="e.g. Punjabi Grammar or General Studies"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Applied if the PDF does not have distinct section headers.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Default Marks per Question
                    </label>
                    <input
                      type="number"
                      className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={defaultImportMarks}
                      onChange={(e) => setDefaultImportMarks(e.target.value)}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Marks awarded for each correct answer (e.g. 1, 2).
                    </p>
                  </div>
                </div>

                {/* Optional Custom API Key (only shown if server doesn't have one) */}
                {!hasServerKey && (
                  <div className="border-t pt-4">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Optional: Google AI Studio API Key (For Scanned / Punjabi Papers)
                    </label>
                    <input
                      type="password"
                      placeholder="Enter free Gemini API key (optional)"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className="w-full border p-2.5 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      💡 Tip: You can get a 100% free key with no credit card at{" "}
                      <a
                        href="https://aistudio.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline font-medium"
                      >
                        aistudio.google.com
                      </a>
                      , or save it as <code className="bg-gray-100 px-1 py-0.5 rounded">GEMINI_API_KEY</code> in your .env file.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowPdfModal(false)}
                    className="px-5 py-2.5 border rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExtracting || !pdfFile}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow flex items-center gap-2 transition-all"
                  >
                    {isExtracting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span>Analyzing & Extracting Questions...</span>
                      </>
                    ) : (
                      <span>Extract Questions →</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Interactive Preview & Verification Screen */}
            {previewStep === "PREVIEW" && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Control bar */}
                <div className="p-4 bg-gray-50 border-b flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm text-gray-800">
                      Found {extractedQuestions.length} Questions
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded-full">
                      {selectedCount} Selected for Import
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-xs font-semibold text-gray-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Questions List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-100">
                  {extractedQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        q.selected
                          ? "bg-white border-blue-300 shadow-sm"
                          : "bg-gray-50 border-gray-200 opacity-60"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={q.selected}
                            onChange={(e) => handleUpdateExtracted(idx, "selected", e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            Question {idx + 1}
                          </span>
                        </label>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500 font-medium">Section:</span>
                            <input
                              type="text"
                              value={q.section}
                              onChange={(e) => handleUpdateExtracted(idx, "section", e.target.value)}
                              className="border p-1 rounded text-xs w-36 bg-white"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteExtracted(idx)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 hover:bg-red-50 rounded"
                            title="Remove question"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="mb-3">
                        <textarea
                          rows={2}
                          value={q.text}
                          onChange={(e) => handleUpdateExtracted(idx, "text", e.target.value)}
                          className="w-full border p-2 rounded text-sm bg-white focus:ring-1 focus:ring-blue-500 font-medium text-gray-900"
                          placeholder="Question text..."
                        />
                      </div>

                      {/* 4 Options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600 w-4">A:</span>
                          <input
                            type="text"
                            value={q.optionA}
                            onChange={(e) => handleUpdateExtracted(idx, "optionA", e.target.value)}
                            className="flex-1 border p-1.5 rounded text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600 w-4">B:</span>
                          <input
                            type="text"
                            value={q.optionB}
                            onChange={(e) => handleUpdateExtracted(idx, "optionB", e.target.value)}
                            className="flex-1 border p-1.5 rounded text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600 w-4">C:</span>
                          <input
                            type="text"
                            value={q.optionC}
                            onChange={(e) => handleUpdateExtracted(idx, "optionC", e.target.value)}
                            className="flex-1 border p-1.5 rounded text-xs bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-600 w-4">D:</span>
                          <input
                            type="text"
                            value={q.optionD}
                            onChange={(e) => handleUpdateExtracted(idx, "optionD", e.target.value)}
                            className="flex-1 border p-1.5 rounded text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Correct Option & Marks */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-800">Correct Answer:</span>
                          <select
                            value={q.correctOption}
                            onChange={(e) => handleUpdateExtracted(idx, "correctOption", e.target.value)}
                            className="border p-1 rounded font-bold text-xs bg-emerald-50 text-emerald-800 border-emerald-300"
                          >
                            <option value="A">Option A</option>
                            <option value="B">Option B</option>
                            <option value="C">Option C</option>
                            <option value="D">Option D</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 font-medium">Marks:</span>
                          <input
                            type="number"
                            value={q.marks}
                            onChange={(e) => handleUpdateExtracted(idx, "marks", parseInt(e.target.value) || 1)}
                            className="border p-1 rounded w-16 text-xs text-center bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setPreviewStep("UPLOAD")}
                    className="px-4 py-2 border rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    ← Upload Different PDF
                  </button>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPdfModal(false)}
                      className="px-4 py-2 border rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={importingBulk || selectedCount === 0}
                      onClick={handleConfirmImport}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold shadow flex items-center gap-2 transition-all"
                    >
                      {importingBulk ? (
                        <span>Importing {selectedCount} Questions...</span>
                      ) : (
                        <span>🚀 Confirm & Import {selectedCount} Questions</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
