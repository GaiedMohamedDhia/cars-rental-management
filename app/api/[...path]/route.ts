import { NextRequest, NextResponse } from "next/server";

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const backendUrl = process.env.INTERNAL_API_BASE_URL;
    if (!backendUrl) {
      return NextResponse.json(
        {
          detail:
            "Le proxy backend du frontend n’est pas configuré. Définissez INTERNAL_API_BASE_URL.",
        },
        { status: 503 },
      );
    }
    const { path } = await params;
    const backendPath = path.join("/");
    const url = new URL(request.url);
    const collectionRoutes = new Set([
      "cars",
      "renters",
      "rentals",
      "payments",
    ]);
    const normalizedBackendPath = collectionRoutes.has(backendPath)
      ? `${backendPath}/`
      : backendPath;

    const targetUrl = `${backendUrl.replace(/\/+$/, "")}/${normalizedBackendPath}${url.search}`;

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        Authorization: request.headers.get("authorization") || "",
      },
      body,
    });

    const responseBody = await response.arrayBuffer();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach backend";

    return NextResponse.json(
      {
        detail:
          "Le serveur FastAPI est momentanément inaccessible. Vérifiez que le service backend est démarré.",
        message,
      },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
