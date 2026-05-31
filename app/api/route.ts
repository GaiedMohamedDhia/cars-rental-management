import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "http://cars-rental-backend:8000";

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendPath = path.join("/");
  const url = new URL(request.url);

  const targetUrl = `${BACKEND_URL}/${backendPath}${url.search}`;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    body,
  });

  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;