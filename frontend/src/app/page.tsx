// src/app/page.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  X,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ThumbsUp,
  Shield,
  Download,
  Copy,
  FilePenLine,
} from "lucide-react";

// Types
interface ParsedData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills?: string[];
  work_experience?: { title: string; company: string; duration: string }[];
  education?: { degree: string; institution: string; year: string }[];
  total_years_experience?: number;
}

interface MatchData {
  skills_match?: {
    matching: string[];
    missing: string[];
  };
  experience_match?: {
    required_years?: number | null;
    resume_years?: number;
    comment?: string;
  };
  overall_fit?: string;
  suggestions?: string[];
}

interface ATSResult {
  ats_score: number;
  checks: { check: string; status: string; detail: string }[];
}

interface AnalysisResult {
  parsed: ParsedData;
  match: MatchData;
  score: number;
  ats?: ATSResult;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [jobDesc, setJobDesc] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cover letter state
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [loadingCoverLetter, setLoadingCoverLetter] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Resume_Analysis_${result?.parsed?.name || "Report"}`,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError("");
      setResult(null);
      setCoverLetter(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
  });

  const handleAnalyze = async () => {
    if (!file || !jobDesc.trim()) {
      setError("Please upload a resume and provide a job description.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setCoverLetter(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("job_desc", jobDesc);
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!file || !jobDesc.trim()) return;
    setLoadingCoverLetter(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("job_desc", jobDesc);
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to generate cover letter");
      const data = await res.json();
      setCoverLetter(data.cover_letter);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingCoverLetter(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optionally show a toast – for simplicity we'll just alert
    alert("Cover letter copied to clipboard!");
  };

  const scorePercentage = result ? Math.round(result.score * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white font-sans">
      {/* Hero Section */}
      <section className="relative py-20 px-6 text-center border-b border-white/10 no-print">
        <div className="absolute inset-0 bg-gradient-to-b from-netflix-red/10 to-transparent pointer-events-none" />
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
          AI Resume Analyzer
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
          Upload your resume, paste a job description, and get an instant match score, ATS check,
          PDF report, and a tailored cover letter — powered by AI.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Sparkles className="w-5 h-5 text-netflix-red" />
          <span className="text-netflix-red font-semibold">Free & Private</span>
        </div>
      </section>

      {/* Upload & Job Description */}
      <section className="max-w-6xl mx-auto px-4 py-12 space-y-10 no-print">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`relative group p-8 rounded-2xl transition-all duration-300 cursor-pointer glass-card hover:border-netflix-red/50 ${
              isDragActive ? "border-netflix-red shadow-[0_0_30px_rgba(229,9,20,0.3)]" : "border-white/10"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              {file ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-netflix-red/10 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-netflix-red" />
                  </div>
                  <p className="text-lg font-semibold">{file.name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-netflix-red/10 flex items-center justify-center group-hover:bg-netflix-red/20 transition-colors">
                    <Upload className="w-10 h-10 text-netflix-red" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">Drag & drop your resume</p>
                    <p className="text-sm text-gray-500 mt-1">PDF or DOCX (max 5 MB)</p>
                  </div>
                  <Button variant="outline" className="border-netflix-red text-netflix-red hover:bg-netflix-red hover:text-white">
                    Browse Files
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Job Description */}
          <div className="glass-card p-8 rounded-2xl border border-white/10 space-y-4">
            <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Job Description
            </label>
            <Textarea
              placeholder="Paste the job description here..."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              rows={8}
              className="w-full bg-transparent border-white/10 focus:border-netflix-red text-white placeholder:text-gray-600 resize-none"
            />
          </div>
        </div>

        {/* Analyze Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleAnalyze}
            disabled={loading || !file || !jobDesc.trim()}
            className="bg-netflix-red hover:bg-red-700 text-white px-12 py-6 text-lg font-bold rounded-full transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                Analyze Resume <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl animate-fade-up">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Results & Actions */}
      {result && (
        <>
          {/* Action buttons (screen only) */}
          <div className="flex flex-wrap justify-center gap-4 no-print mb-8">
            <Button
              onClick={() => handlePrint()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg"
            >
              <Download className="w-5 h-5" /> Download PDF Report
            </Button>
            <Button
              onClick={handleGenerateCoverLetter}
              disabled={loadingCoverLetter}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg"
            >
              {loadingCoverLetter ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FilePenLine className="w-5 h-5" /> Generate Cover Letter
                </>
              )}
            </Button>
          </div>

          {/* Printable content */}
          <div ref={printRef} className="print-area max-w-6xl mx-auto px-4 py-8 space-y-10">
            {/* Print-only header */}
            <div className="print-only hidden text-center border-b pb-4 mb-6">
              <h1 className="text-2xl font-bold">AI Resume Analyzer – Report</h1>
              <p className="text-gray-600">
                {result.parsed.name ? `Candidate: ${result.parsed.name}` : ""}
                {result.parsed.email ? ` | ${result.parsed.email}` : ""}
              </p>
            </div>

            {/* Score Circle + Overall Fit */}
            <div className="flex flex-col items-center score-circle-print">
              <div className="relative w-44 h-44">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#222" strokeWidth="8" />
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="#E50914"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - scorePercentage / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-white">{scorePercentage}%</span>
                  <span className="text-xs text-gray-400 mt-1">Overall Fit</span>
                </div>
              </div>
              {result.match?.overall_fit && (
                <p className="mt-2 text-lg font-semibold capitalize text-netflix-red">
                  {result.match.overall_fit}
                </p>
              )}
            </div>

            {/* ATS Compatibility */}
            {result.ats && (
              <Card className="glass-card border border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5 text-blue-500" />
                    ATS Compatibility Score: {result.ats.ats_score}%
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.ats.checks.map((check, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {check.status === "pass" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="text-sm">{check.check}: <span className="text-gray-400">{check.detail}</span></span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Skills Match / Missing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass-card border border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Matching Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.match?.skills_match?.matching?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.match.skills_match.matching.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No matching skills detected</p>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card border border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Missing Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.match?.skills_match?.missing?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.match.skills_match.missing.map((skill, idx) => (
                        <span key={idx} className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-medium border border-red-500/20">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-green-500">No missing skills – great match!</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Experience Match */}
            {result.match?.experience_match && (
              <Card className="glass-card border border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="w-5 h-5 text-netflix-red" />
                    Experience Match
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {result.match.experience_match.comment === "meets requirements" ? (
                      <span className="text-green-400">✅ Meets requirements</span>
                    ) : result.match.experience_match.comment === "below requirements" ? (
                      <span className="text-red-400">⚠️ Below requirements</span>
                    ) : (
                      <span className="text-gray-400">⚪ Not specified in job description</span>
                    )}
                    {result.match.experience_match.required_years && (
                      <span className="ml-2 text-gray-500">
                        (Required: {result.match.experience_match.required_years} years, Your resume: {result.match.experience_match.resume_years} years)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Suggestions */}
            {result.match?.suggestions?.length > 0 && (
              <Card className="glass-card border border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    How to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.match.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex gap-3 items-start p-3 bg-white/5 rounded-lg">
                      <ThumbsUp className="w-4 h-4 text-netflix-red mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-300">{suggestion}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Cover Letter (if generated) – included in print */}
            {coverLetter && (
              <Card className="glass-card border border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FilePenLine className="w-5 h-5 text-emerald-500" />
                    Generated Cover Letter
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="whitespace-pre-line text-sm text-gray-300 bg-black/20 p-4 rounded-lg">
                    {coverLetter}
                  </div>
                  <Button
                    onClick={() => copyToClipboard(coverLetter)}
                    className="no-print bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy to Clipboard
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Original Resume Info */}
            <details className="glass-card border border-white/10 rounded-2xl p-6" open>
              <summary className="text-lg font-semibold cursor-pointer text-netflix-red">
                View Extracted Resume Details
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Personal Info</h4>
                  <p className="text-sm"><User className="inline w-4 h-4 mr-1" /> {result.parsed.name || "—"}</p>
                  <p className="text-sm"><Mail className="inline w-4 h-4 mr-1" /> {result.parsed.email || "—"}</p>
                  <p className="text-sm"><Phone className="inline w-4 h-4 mr-1" /> {result.parsed.phone || "—"}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {result.parsed.skills?.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">Education</h4>
                  {result.parsed.education?.map((edu, idx) => (
                    <p key={idx} className="text-xs">{edu.degree} – {edu.institution} ({edu.year})</p>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </>
      )}
    </main>
  );
}