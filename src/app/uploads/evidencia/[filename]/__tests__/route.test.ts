import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { GET, OPTIONS } from "../route";

describe("GET /uploads/evidencia/[filename] (HU-43)", () => {
  let tempUploadDir: string;
  const originalUploadDir = process.env.UPLOAD_DIR;

  beforeEach(async () => {
    tempUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "sgrai-serve-test-"));
    process.env.UPLOAD_DIR = tempUploadDir;
    await fs.mkdir(path.join(tempUploadDir, "evidencia"), { recursive: true });
    await fs.writeFile(
      path.join(tempUploadDir, "evidencia", "video_prueba.mp4"),
      Buffer.from("0123456789abcdef", "utf-8")
    );
  });

  afterEach(async () => {
    process.env.UPLOAD_DIR = originalUploadDir;
    await fs.rm(tempUploadDir, { recursive: true, force: true });
  });

  it("debe servir el archivo completo con 200, Accept-Ranges, CORS y nosniff (BUG-H43-API-06)", async () => {
    const req = new NextRequest("http://localhost:3000/uploads/evidencia/video_prueba.mp4", {
      headers: { origin: "http://localhost:3000" },
    });
    const res = await GET(req, { params: Promise.resolve({ filename: "video_prueba.mp4" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("debe responder 206 Partial Content cuando se solicita cabecera Range con CORS y nosniff", async () => {
    const req = new NextRequest("http://localhost:3000/uploads/evidencia/video_prueba.mp4", {
      headers: { range: "bytes=0-4", origin: "http://localhost:3002" },
    });
    const res = await GET(req, { params: Promise.resolve({ filename: "video_prueba.mp4" }) });

    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 0-4/16");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3002");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const text = await res.text();
    expect(text).toBe("01234");
  });

  it("debe responder 204 a preflight OPTIONS con cabeceras CORS", async () => {
    const req = new NextRequest("http://localhost:3000/uploads/evidencia/video_prueba.mp4", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3000" },
    });
    const res = await OPTIONS(req);

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("debe rechazar intentos de path traversal con 400", async () => {
    const req = new NextRequest("http://localhost:3000/uploads/evidencia/..secret.mp4");
    const res = await GET(req, { params: Promise.resolve({ filename: "..secret.mp4" }) });

    expect(res.status).toBe(400);
  });
});
