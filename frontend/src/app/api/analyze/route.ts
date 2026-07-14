// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

    const res = await fetch(`${backendUrl}/analyze`, {
      method: "POST",
      body: formData,
      // Don't set Content-Type header; browser will set it with boundary
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { detail: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}