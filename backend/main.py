# main.py
# ============================================================
# AI Resume Analyzer – FastAPI Backend
# Features: upload resume (PDF/DOCX), extract text,
#           parse with Groq LLM, match with job description,
#           store results in Supabase (with embeddings),
#           ATS compatibility check, cover letter generation.
# 100% free tier compatible.
# ============================================================

import os
import json
import logging
import re
import sys
import traceback
from typing import List, Dict, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Text extraction libraries
try:
    import unstructured
except ImportError:
    unstructured = None
import pdfplumber
import docx

# Groq LLM (free)
from groq import Groq

# Embedding and similarity
from sentence_transformers import SentenceTransformer
import numpy as np

# Supabase client
from supabase import create_client, Client

# -----------------------------------------------------------
# Load environment variables from .env file
# -----------------------------------------------------------
load_dotenv()

# -----------------------------------------------------------
# Configuration & Initialization (WRAPPED IN TRY/EXCEPT)
# -----------------------------------------------------------
print("=== Starting main.py ===", flush=True)

try:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

    if not GROQ_API_KEY or not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Missing required environment variables. Check your .env file.")

    # Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("Supabase client created.", flush=True)

    # Groq client (free API – no credit card needed)
    groq_client = Groq(api_key=GROQ_API_KEY)
    print("Groq client created.", flush=True)

    # Embedding model (local, free, runs on CPU)
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    print("Embedding model loaded.", flush=True)

except Exception:
    print("=== FATAL STARTUP ERROR ===", flush=True)
    traceback.print_exc()
    sys.exit(1)

# FastAPI app
app = FastAPI(title="AI Resume Analyzer")

# Basic logging
logging.basicConfig(level=logging.INFO)

# -----------------------------------------------------------
# 1. Text Extraction Function
# -----------------------------------------------------------
def extract_text(file: UploadFile) -> str:
    """
    Extracts raw text from a PDF or DOCX resume.
    Tries unstructured first (handles complex layouts),
    then pdfplumber for PDFs, then python-docx for .docx.
    """
    content = file.file.read()
    filename = file.filename.lower() if file.filename else ""

    # Try unstructured if available (best for messy PDFs)
    if unstructured and (filename.endswith(".pdf") or filename.endswith(".docx")):
        try:
            elements = unstructured.partition(
                file=file.file,
                content_type="application/pdf" if filename.endswith(".pdf") else "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            return "\n".join([str(el) for el in elements])
        except Exception as e:
            logging.warning(f"Unstructured failed: {e}, falling back to specific parser.")

    # Fallback to pdfplumber for PDFs
    if filename.endswith(".pdf"):
        try:
            import io
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                return text if text.strip() else ""
        except Exception as e:
            logging.error(f"pdfplumber failed: {e}")
            raise HTTPException(status_code=400, detail="Could not read PDF file.")

    # Fallback to python-docx
    elif filename.endswith(".docx"):
        try:
            import io
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join(para.text for para in doc.paragraphs)
            return text if text.strip() else ""
        except Exception as e:
            logging.error(f"python-docx failed: {e}")
            raise HTTPException(status_code=400, detail="Could not read DOCX file.")

    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF or DOCX.")

# -----------------------------------------------------------
# 2. Groq-based Resume Parser
# -----------------------------------------------------------
def analyze_resume_v2(text: str, job_desc: str) -> dict:
    system_prompt = (
        "You are an expert resume analyst. Given a resume text and a job description, you must output ONLY valid JSON (no other text). "
        "The JSON must have exactly this structure:\n"
        "{\n"
        '  "resume": {\n'
        '    "name": ..., "email": ..., "phone": ...,\n'
        '    "skills": [...],\n'
        '    "work_experience": [{"title": ..., "company": ..., "duration": ...}],\n'
        '    "education": [{"degree": ..., "institution": ..., "year": ...}],\n'
        '    "total_years_experience": (number, inferred from durations, 0 if none)\n'
        '  },\n'
        '  "match": {\n'
        '    "skills_match": {\n'
        '      "matching": [...],\n'
        '      "missing": [...]\n'
        '    },\n'
        '    "experience_match": {\n'
        '      "required_years": (number or null if not specified),\n'
        '      "resume_years": (number),\n'
        '      "comment": "meets requirements" or "below requirements" or "not specified"\n'
        '    },\n'
        '    "overall_fit": "strong" / "moderate" / "weak" (based on skills and experience),\n'
        '    "suggestions": [list of actionable tips to improve the resume for this job]\n'
        '  }\n'
        "}\n"
        "If a field cannot be found, use null (for strings) or empty list (for arrays)."
    )

    user_prompt = f"Resume:\n{text}\n\nJob Description:\n{job_desc}"

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            max_tokens=2000,
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        logging.error(f"Groq analysis error: {e}")
        return {
            "resume": {"name": None, "email": None, "phone": None, "skills": [], "work_experience": [], "education": [], "total_years_experience": 0},
            "match": {"skills_match": {"matching": [], "missing": []}, "experience_match": {"required_years": None, "resume_years": 0, "comment": "not specified"}, "overall_fit": "weak", "suggestions": []}
        }

# -----------------------------------------------------------
# 3. Embedding & Score Calculation
# -----------------------------------------------------------
def compute_score(resume_text: str, job_description: str) -> float:
    """
    Generates embeddings for resume text and job description,
    returns cosine similarity as a match score (0-1).
    """
    emb_resume = embedder.encode(resume_text)
    emb_jd = embedder.encode(job_description)
    score = np.dot(emb_resume, emb_jd) / (np.linalg.norm(emb_resume) * np.linalg.norm(emb_jd))
    return float(score)

# -----------------------------------------------------------
# 4. ATS Compatibility Check
# -----------------------------------------------------------
def ats_check(raw_text: str, filename: str) -> dict:
    """
    Performs a basic ATS compatibility check on the resume.
    Returns a checklist and a score out of 100.
    """
    checks = []
    score = 0
    max_score = 7

    # 1. File format
    if filename.lower().endswith((".pdf", ".docx")):
        checks.append({"check": "File format", "status": "pass", "detail": "PDF or DOCX (ATS-friendly)"})
        score += 1
    else:
        checks.append({"check": "File format", "status": "fail", "detail": "Use PDF or DOCX for ATS"})

    # 2. Standard section headings
    headings = ["experience", "education", "skills", "summary", "objective"]
    found_headings = []
    for heading in headings:
        if re.search(rf"\b{heading}\b", raw_text, re.IGNORECASE):
            found_headings.append(heading)
    if len(found_headings) >= 2:
        checks.append({"check": "Standard headings", "status": "pass", "detail": f"Found: {', '.join(found_headings)}"})
        score += 1
    else:
        checks.append({"check": "Standard headings", "status": "fail", "detail": "Missing key sections (e.g., Work Experience, Education, Skills)"})

    # 3. Contact information present
    email_match = re.search(r'\b[\w\.-]+@[\w\.-]+\.\w+\b', raw_text)
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,9}', raw_text)
    if email_match and phone_match:
        checks.append({"check": "Contact info", "status": "pass", "detail": "Email and phone number found"})
        score += 1
    else:
        checks.append({"check": "Contact info", "status": "fail", "detail": "Missing email or phone number"})

    # 4. No images or scanned content (heuristic: very low text density might indicate image-only)
    text_length = len(raw_text.strip())
    if text_length > 200:
        checks.append({"check": "Text-based content", "status": "pass", "detail": f"Resume contains {text_length} characters of text"})
        score += 1
    else:
        checks.append({"check": "Text-based content", "status": "fail", "detail": "Text too short – may be image-based (use OCR)"})

    # 5. No unusual unicode (common in garbled PDFs)
    unusual_chars = re.findall(r'[^\x00-\x7F\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u00A0\u00B0]', raw_text)
    if len(unusual_chars) < 10:
        checks.append({"check": "No garbled text", "status": "pass", "detail": "No excessive Unicode artifacts"})
        score += 1
    else:
        checks.append({"check": "No garbled text", "status": "fail", "detail": "Resume may contain corrupt characters from PDF conversion"})

    # 6. Bullet points used (for readability)
    if re.search(r'[•\-\*\u2022]', raw_text):
        checks.append({"check": "Bullet points", "status": "pass", "detail": "Bullet points help ATS parse achievements"})
        score += 1
    else:
        checks.append({"check": "Bullet points", "status": "fail", "detail": "Use bullet points for work experience"})

    # 7. Action verbs present (crude check)
    action_verbs = ["managed", "developed", "created", "designed", "implemented", "led", "achieved", "improved", "reduced", "increased"]
    found_verbs = [v for v in action_verbs if re.search(rf'\b{v}\b', raw_text, re.IGNORECASE)]
    if len(found_verbs) >= 3:
        checks.append({"check": "Action verbs", "status": "pass", "detail": f"Uses strong verbs like {', '.join(found_verbs[:3])}"})
        score += 1
    else:
        checks.append({"check": "Action verbs", "status": "fail", "detail": "Add action verbs (managed, developed, etc.)"})

    percentage = int((score / max_score) * 100)

    return {
        "ats_score": percentage,
        "checks": checks
    }

# -----------------------------------------------------------
# 5. Cover Letter Generation
# -----------------------------------------------------------
def generate_cover_letter(resume_text: str, job_desc: str) -> str:
    """
    Uses Groq to generate a tailored cover letter based on the resume and job description.
    """
    system_prompt = (
        "You are a professional cover letter writer. Write a concise, tailored cover letter for the job description provided. "
        "Incorporate relevant skills and experience from the resume. "
        "Use a formal, polite tone. Keep it to 3-4 short paragraphs. "
        "Address the letter to 'Hiring Manager'. Include a subject line. "
        "Output ONLY the cover letter text, no additional commentary."
    )

    user_prompt = f"Resume:\n{resume_text}\n\nJob Description:\n{job_desc}"

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1000,
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Cover letter generation error: {e}")
        return "Sorry, we couldn't generate the cover letter at this time. Please try again."

# -----------------------------------------------------------
# 6. Main API Endpoint – Resume Analysis
# -----------------------------------------------------------
@app.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_desc: str = Form(...),
    user_id: str = Form(None)
):
    """
    Upload a resume (PDF or DOCX) and a job description.
    Returns parsed resume data, match score, ATS compatibility.
    """
    # --- Step A: Extract raw text ---
    raw_text = extract_text(file)
    if not raw_text or len(raw_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract sufficient text from the file.")

    # --- Step B: Parse with Groq ---
    analysis = analyze_resume_v2(raw_text, job_desc)

    # --- Step C: Compute match score ---
    score = compute_score(raw_text, job_desc)

    # --- Step D: ATS Check ---
    ats_result = ats_check(raw_text, file.filename)

    # --- Step E: Store in Supabase ---
    try:
        resume_embedding = embedder.encode(raw_text).tolist()
        data = {
            "filename": file.filename,
            "raw_text": raw_text,
            "parsed_data": analysis,
            "embedding": resume_embedding,
            "job_description": job_desc,
            "score": score,
            "user_id": user_id if user_id else None
        }
        supabase.table("resumes").insert(data).execute()
    except Exception as e:
        logging.error(f"Supabase insert failed: {e}")

    # --- Return success ---
    return JSONResponse(content={
        "parsed": analysis.get("resume", {}),
        "match": analysis.get("match", {}),
        "score": score,
        "ats": ats_result,
        "raw_text_preview": raw_text[:200]
    })

# -----------------------------------------------------------
# 7. Cover Letter Endpoint
# -----------------------------------------------------------
@app.post("/cover-letter")
async def cover_letter(
    file: UploadFile = File(...),
    job_desc: str = Form(...)
):
    """
    Generates a cover letter based on the uploaded resume and job description.
    """
    raw_text = extract_text(file)
    if not raw_text or len(raw_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract sufficient text from the file.")

    letter = generate_cover_letter(raw_text, job_desc)
    return JSONResponse(content={"cover_letter": letter})

# -----------------------------------------------------------
# Health check
# -----------------------------------------------------------
@app.get("/")
def home():
    return {"message": "AI Resume Analyzer is running. Use POST /analyze to test."}