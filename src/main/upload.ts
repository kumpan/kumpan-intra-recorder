import { createReadStream, statSync } from "node:fs"
import { basename } from "node:path"
import { Readable, Transform } from "node:stream"
import { request as httpsRequest } from "node:https"
import { request as httpRequest } from "node:http"
import { randomBytes } from "node:crypto"
import type { UploadOutcome, UploadProgress } from "@/shared/types"

type UploadParams = {
  baseUrl: string
  token: string
  filePath: string
  durationSeconds: number
  startedAt: string
  endedAt: string
  onProgress: (p: UploadProgress) => void
}

const UPLOAD_PATH = "/api/sales/transcripts/upload"

export async function uploadRecording(params: UploadParams): Promise<UploadOutcome> {
  const url = new URL(`${params.baseUrl}${UPLOAD_PATH}`)
  const isHttps = url.protocol === "https:"
  const boundary = `----kumpan-${randomBytes(16).toString("hex")}`
  const filename = basename(params.filePath)
  const fileSize = statSync(params.filePath).size

  const fieldPart = (name: string, value: string): string =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`

  const fileHeader =
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: audio/webm\r\n\r\n`

  const trailingFields =
    fieldPart("duration", String(params.durationSeconds)) +
    fieldPart("startedAt", params.startedAt) +
    fieldPart("endedAt", params.endedAt) +
    `--${boundary}--\r\n`

  const fileHeaderBuf = Buffer.from(fileHeader, "utf8")
  const trailingBuf = Buffer.from(`\r\n${trailingFields}`, "utf8")
  const totalBytes = fileHeaderBuf.length + fileSize + trailingBuf.length

  async function* bodyParts(): AsyncGenerator<Buffer> {
    yield fileHeaderBuf
    for await (const chunk of createReadStream(params.filePath)) {
      yield chunk as Buffer
    }
    yield trailingBuf
  }

  const body = Readable.from(bodyParts())

  let sentBytes = 0
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      sentBytes += chunk.length
      params.onProgress({ sentBytes, totalBytes })
      cb(null, chunk)
    },
  })

  const lib = isHttps ? httpsRequest : httpRequest
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80

  return await new Promise<UploadOutcome>((resolve) => {
    const req = lib({
      method: "POST",
      hostname: url.hostname,
      port,
      path: `${url.pathname}${url.search}`,
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": totalBytes,
        Accept: "application/json",
      },
    })

    req.on("response", (res) => {
      const status = res.statusCode ?? 0
      const chunks: Buffer[] = []
      res.on("data", (c: Buffer) => chunks.push(c))
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8")
        resolve(interpretResponse(status, raw))
      })
    })

    req.on("error", (err) => {
      resolve({ ok: false, status: 0, message: err.message })
    })

    body.pipe(counter).pipe(req)
  })
}

function interpretResponse(status: number, raw: string): UploadOutcome {
  if (status >= 200 && status < 300) {
    try {
      const parsed = JSON.parse(raw) as { id?: unknown; viewUrl?: unknown }
      if (typeof parsed.id === "string" && typeof parsed.viewUrl === "string") {
        return { ok: true, status, id: parsed.id, viewUrl: parsed.viewUrl }
      }
      return { ok: false, status, message: "Unexpected response body from intra." }
    } catch {
      return { ok: false, status, message: "Invalid JSON in intra response." }
    }
  }
  if (status === 401) {
    return { ok: false, status, message: "Token rejected. Update it in Settings." }
  }
  if (status === 413) {
    return { ok: false, status, message: "Recording exceeds the 200 MB upload limit." }
  }
  return { ok: false, status, message: `Upload failed (${status || "network error"}).` }
}
