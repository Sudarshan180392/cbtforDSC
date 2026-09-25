"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

function BatchResultsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [batches, setBatches] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUBMITTED" | "PENDING">("ALL");
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // 1. Fetch Batches and Exams on load
  useEffect(() => {
    async function init() {
      try {
        const [batchesRes, examsRes] = await Promise.all([
          fetch("/api/admin/batches"),
          fetch("/api/admin/exam"),
        ]);

        let loadedBatches: any[] = [];
        let loadedExams: any[] = [];

        if (batchesRes.ok) loadedBatches = await batchesRes.json();
        if (examsRes.ok) loadedExams = await examsRes.json();

        setBatches(loadedBatches);
        setExams(loadedExams);

        // Preselect batch from query param or first batch
        const queryBatchId = searchParams.get("batchId");
        const queryExamId = searchParams.get("examId");

        let initialBatch = loadedBatches[0];
        if (queryBatchId) {
          const found = loadedBatches.find((b) => String(b.id) === queryBatchId);
          if (found) initialBatch = found;
        }

        if (initialBatch) {
          setSelectedBatchId(String(initialBatch.id));
          const initialExamId = queryExamId || (initialBatch.activeExamId ? String(initialBatch.activeExamId) : (loadedExams[0]?.id ? String(loadedExams[0].id) : ""));
          setSelectedExamId(initialExamId);
        }
      } catch (e) {
        console.error("Error loading batches/exams:", e);
        setErrorMsg("Failed to load batches or exams list.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [searchParams]);

  // 2. Fetch Report whenever selectedBatchId or selectedExamId changes
  const fetchReport = async (bId: string, eId: string) => {
    if (!bId) return;
    setReportLoading(true);
    setErrorMsg("");
    try {
      let url = `/api/admin/reports/batch-exam?batchId=${bId}`;
      if (eId) url += `&examId=${eId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setReport(data);
      } else {
        setReport(null);
        setErrorMsg(data.error || "Failed to load report data.");
      }
    } catch (e) {
      console.error("Error fetching batch report:", e);
      setReport(null);
      setErrorMsg("Network error fetching report data.");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchReport(selectedBatchId, selectedExamId);
    }
  }, [selectedBatchId, selectedExamId]);

  // Handle batch selection change: auto-select batch's active exam if available
  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    const batch = batches.find((b) => String(b.id) === batchId);
    if (batch?.activeExamId) {
      setSelectedExamId(String(batch.activeExamId));
    }
  };

  // PDF Direct Download Handler
  const handleDownloadPdf = () => {
    if (!selectedBatchId) return;
    setDownloadingPdf(true);
    let url = `/api/admin/reports/batch-exam-pdf?batchId=${selectedBatchId}`;
    if (selectedExamId) url += `&examId=${selectedExamId}`;

    // Trigger download
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = `Batch_Results_Report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setDownloadingPdf(false), 1500);
  };

  // Filtered Students Roster
  const filteredStudents = useMemo(() => {
    if (!report?.students) return [];
    return report.students.filter((s: any) => {
      // Status filter
      if (statusFilter === "SUBMITTED" && !s.isSubmitted) return false;
      if (statusFilter === "PENDING" && s.isSubmitted) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesRoll = s.rollNo.toLowerCase().includes(q);
        return matchesName || matchesRoll;
      }
      return true;
    });
  }, [report, statusFilter, searchQuery]);

  const getPerformanceTag = (s: any) => {
    if (!s.isSubmitted) {
      return { label: "Awaiting Exam", color: "bg-gray-100 text-gray-600 border-gray-300" };
    }
    if (s.percentage >= 80) {
      return { label: "🌟 Excellent", color: "bg-emerald-50 text-emerald-700 border-emerald-300" };
    }
    if (s.percentage >= 60) {
      return { label: "👍 Good", color: "bg-blue-50 text-blue-700 border-blue-300" };
    }
    if (s.percentage >= 40) {
      return { label: "⚠️ Average (Revise)", color: "bg-amber-50 text-amber-700 border-amber-300" };
    }
    return { label: "🚨 Needs Guidance", color: "bg-rose-50 text-rose-700 border-rose-300" };
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                ← Admin Dashboard
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/admin/batches" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                🏷️ Batches
              </Link>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
              <span>📊</span> Batch Results & PDF Reports
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review full batch marks, question breakdowns (correct, wrong, skipped), rankings, and export official PDF reports.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              disabled={!report || reportLoading}
              className="bg-white hover:bg-gray-100 text-slate-700 font-semibold py-2.5 px-4 rounded-lg border border-gray-300 shadow-sm text-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              title="Print or Save as PDF via browser"
            >
              <span>🖨️</span> Print View
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={!report || reportLoading || downloadingPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span>📥</span>
              {downloadingPdf ? "Generating PDF..." : "Download Batch PDF Report"}
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-4">
          {/* Batch Selector */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Batch *
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b._count?.users || 0} students)
                </option>
              ))}
            </select>
          </div>

          {/* Exam Selector */}
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Exam *
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.duration}m | {ex.totalMarks} marks)
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <div className="self-end">
            <button
              onClick={() => fetchReport(selectedBatchId, selectedExamId)}
              disabled={reportLoading}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg border border-gray-300 transition-colors"
            >
              {reportLoading ? "Refreshing..." : "🔄 Refresh"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-800 rounded-lg text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* Loading state */}
        {reportLoading && (
          <div className="bg-white p-12 rounded-xl shadow-sm text-center text-slate-500 font-semibold">
            <div className="animate-spin text-3xl mb-2">⏳</div>
            Loading batch examination performance...
          </div>
        )}

        {/* Main Content when loaded */}
        {!reportLoading && report && (
          <div className="space-y-6">
            {/* Completion Status Alert Banner */}
            {report.stats.isAllSubmitted ? (
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl flex items-center justify-between gap-4 text-emerald-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <h2 className="text-base font-bold">All Students in Batch Have Submitted! (100% Complete)</h2>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      All {report.stats.totalEnrolled} enrolled students have submitted their exam. The official batch rankings and final marks are ready for review.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow whitespace-nowrap transition-colors"
                >
                  Download Final PDF
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-center justify-between gap-4 text-amber-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⏳</span>
                  <div>
                    <h2 className="text-base font-bold">
                      Exam in Progress: {report.stats.totalSubmitted} of {report.stats.totalEnrolled} Students Submitted
                    </h2>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {report.stats.totalPending} student{report.stats.totalPending === 1 ? " is" : "s are"} still pending submission. You can view current scores or download an interim PDF report at any time.
                    </p>
                  </div>
                </div>
                <div className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full border border-amber-300 whitespace-nowrap">
                  {report.stats.totalSubmitted}/{report.stats.totalEnrolled} Complete
                </div>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: Total Enrolled */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">Total Enrolled</div>
                <div className="text-2xl font-black text-slate-900">{report.stats.totalEnrolled} Students</div>
                <div className="text-xs text-slate-500 mt-1">Batch: {report.batchName}</div>
              </div>

              {/* Metric 2: Submissions */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Submissions</div>
                <div className="text-2xl font-black text-slate-900">
                  {report.stats.totalSubmitted}{" "}
                  <span className="text-sm font-bold text-slate-400">/ {report.stats.totalEnrolled}</span>
                </div>
                <div className="text-xs font-semibold text-emerald-600 mt-1">
                  {report.stats.totalEnrolled > 0
                    ? `${Math.round((report.stats.totalSubmitted / report.stats.totalEnrolled) * 100)}% submission rate`
                    : "0%"}
                </div>
              </div>

              {/* Metric 3: Class Average */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Class Average</div>
                <div className="text-2xl font-black text-slate-900">
                  {report.stats.classAverage.toFixed(1)}{" "}
                  <span className="text-sm font-semibold text-slate-400">/ {report.totalMarks}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Avg: {report.totalMarks > 0 ? ((report.stats.classAverage / report.totalMarks) * 100).toFixed(1) : 0}%
                </div>
              </div>

              {/* Metric 4: Batch Topper */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">Batch Topper (Rank 1)</div>
                {report.stats.topperName ? (
                  <>
                    <div className="text-lg font-black text-slate-900 truncate" title={report.stats.topperName}>
                      🥇 {report.stats.topperName}
                    </div>
                    <div className="text-xs font-semibold text-purple-700 mt-0.5">
                      Score: {report.stats.highestScore} / {report.totalMarks} ({report.stats.topperRoll})
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400 italic mt-2">No submissions yet</div>
                )}
              </div>
            </div>

            {/* Students Roster Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Table Toolbar */}
              <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <span className="text-slate-400 text-sm">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by student name or roll number..."
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Show:</span>
                  {(["ALL", "SUBMITTED", "PENDING"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                        statusFilter === filter
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-slate-700 border-gray-300 hover:bg-slate-100"
                      }`}
                    >
                      {filter === "ALL" ? `All (${report.students.length})` : filter === "SUBMITTED" ? `Submitted (${report.stats.totalSubmitted})` : `Pending (${report.stats.totalPending})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 border-b border-gray-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <th className="py-3.5 px-4 text-center">Batch Rank</th>
                      <th className="py-3.5 px-4">Roll No</th>
                      <th className="py-3.5 px-4">Student Name</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Marks Scored</th>
                      <th className="py-3.5 px-4 text-right">Correct (✓)</th>
                      <th className="py-3.5 px-4 text-right">Wrong (✗)</th>
                      <th className="py-3.5 px-4 text-right">Skipped (-)</th>
                      <th className="py-3.5 px-4 text-right">% Marks</th>
                      <th className="py-3.5 px-4 text-center">Guidance Directive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400">
                          No students matched your search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s: any) => {
                        const tag = getPerformanceTag(s);
                        return (
                          <tr key={s.rollNo} className="hover:bg-slate-50/80 transition-colors">
                            {/* Rank */}
                            <td className="py-3 px-4 text-center font-bold">
                              {s.isSubmitted ? (
                                s.rank === 1 ? (
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
                                    🥇 #1
                                  </span>
                                ) : s.rank === 2 ? (
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-slate-200 text-slate-800 border border-slate-300">
                                    🥈 #2
                                  </span>
                                ) : s.rank === 3 ? (
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-300">
                                    🥉 #3
                                  </span>
                                ) : (
                                  <span className="text-slate-600 font-mono text-xs">#{s.rank}</span>
                                )
                              ) : (
                                <span className="text-slate-300 font-mono">—</span>
                              )}
                            </td>

                            {/* Roll No */}
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 text-xs">{s.rollNo}</td>

                            {/* Student Name */}
                            <td className="py-3 px-4 font-medium text-slate-900">{s.name}</td>

                            {/* Status */}
                            <td className="py-3 px-4 text-center">
                              {s.isSubmitted ? (
                                <span className="inline-block bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  Submitted
                                </span>
                              ) : (
                                <span className="inline-block bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  Pending
                                </span>
                              )}
                            </td>

                            {/* Score */}
                            <td className="py-3 px-4 text-right font-black text-slate-900">
                              {s.isSubmitted ? (
                                <span>
                                  {s.score}{" "}
                                  <span className="text-xs text-slate-400 font-normal">/ {report.totalMarks}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Correct */}
                            <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                              {s.isSubmitted ? s.correctCount : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Wrong */}
                            <td className="py-3 px-4 text-right font-semibold text-rose-600">
                              {s.isSubmitted ? s.incorrectCount : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Skipped */}
                            <td className="py-3 px-4 text-right font-semibold text-amber-700">
                              {s.isSubmitted ? s.unansweredCount : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Percentage */}
                            <td className="py-3 px-4 text-right font-mono text-slate-700 font-bold">
                              {s.isSubmitted ? `${s.percentage.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                            </td>

                            {/* Guidance Category */}
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${tag.color}`}
                              >
                                {tag.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Summary */}
              <div className="p-4 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                <div>
                  Showing <b>{filteredStudents.length}</b> of <b>{report.students.length}</b> enrolled students in batch
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Correct (+marks)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Wrong (-{report.negativeMarks})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Skipped / Unanswered
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Guidance Directives Section */}
            <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-5">
              <h2 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                <span>💡</span> Academic Counseling & Guidance Directives for Admin & Teachers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="p-3 bg-rose-50/60 rounded-lg border border-rose-200">
                  <h3 className="font-bold text-rose-900 mb-1">Targeting Students with High "Wrong" Answers:</h3>
                  <p>
                    Students with excessive wrong answers suffer from severe negative marking penalties (-{report.negativeMarks} marks each).
                    Guide them on intelligent question elimination and train them to leave uncertain questions untouched rather than making random guesses.
                  </p>
                </div>
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
                  <h3 className="font-bold text-amber-900 mb-1">Targeting Students with High "Skipped" Count:</h3>
                  <p>
                    Students with many skipped questions often struggle with test pacing, time pressure, or syllabus gaps.
                    Provide time-management strategy sessions and targeted topic drills to build their speed and confidence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Loading Results...</div>}>
      <BatchResultsContent />
    </Suspense>
  );
}
