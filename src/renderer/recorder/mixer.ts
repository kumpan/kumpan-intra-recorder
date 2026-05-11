export type RecordingSession = {
  stop: () => Promise<void>
  abort: () => Promise<void>
}

export type RecordingHandlers = {
  onChunk: (data: ArrayBuffer) => void
  onError: (message: string) => void
  onStopped: () => void
}

const CHUNK_MS = 1000
const MIME_TYPE = "audio/webm; codecs=opus"

async function getSystemAudioStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  })
  stream.getVideoTracks().forEach((t) => t.stop())
  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    throw new Error(
      "macOS did not provide a system audio track. Open System Settings → Privacy & Security → Screen Recording, toggle the app off and on, then quit and reopen."
    )
  }
  return new MediaStream(audioTracks)
}

async function getMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  })
}

function buildStereoMix(
  ctx: AudioContext,
  systemStream: MediaStream,
  micStream: MediaStream
): MediaStream {
  const systemSource = ctx.createMediaStreamSource(systemStream)
  const micSource = ctx.createMediaStreamSource(micStream)

  const systemMono = ctx.createGain()
  systemMono.channelCount = 1
  systemMono.channelCountMode = "explicit"
  systemMono.channelInterpretation = "speakers"
  systemSource.connect(systemMono)

  const micMono = ctx.createGain()
  micMono.channelCount = 1
  micMono.channelCountMode = "explicit"
  micMono.channelInterpretation = "speakers"
  micSource.connect(micMono)

  const merger = ctx.createChannelMerger(2)
  systemMono.connect(merger, 0, 0)
  micMono.connect(merger, 0, 1)

  const dest = ctx.createMediaStreamDestination()
  merger.connect(dest)
  return dest.stream
}

export async function startMixedRecording(
  handlers: RecordingHandlers
): Promise<RecordingSession> {
  if (!MediaRecorder.isTypeSupported(MIME_TYPE)) {
    throw new Error(`MediaRecorder mimeType not supported: ${MIME_TYPE}`)
  }

  const systemStream = await getSystemAudioStream()
  let micStream: MediaStream
  try {
    micStream = await getMicStream()
  } catch (err) {
    systemStream.getTracks().forEach((t) => t.stop())
    throw err
  }

  const ctx = new AudioContext()
  const mixed = buildStereoMix(ctx, systemStream, micStream)

  const recorder = new MediaRecorder(mixed, { mimeType: MIME_TYPE })
  let stopped = false

  recorder.addEventListener("dataavailable", (event) => {
    if (!event.data || event.data.size === 0) return
    event.data
      .arrayBuffer()
      .then((buf) => handlers.onChunk(buf))
      .catch((err: unknown) => {
        handlers.onError(err instanceof Error ? err.message : "Chunk read error.")
      })
  })

  recorder.addEventListener("error", (event) => {
    const err = (event as ErrorEvent).error
    handlers.onError(err instanceof Error ? err.message : "MediaRecorder error.")
  })

  recorder.addEventListener("stop", () => {
    stopped = true
    teardown(systemStream, micStream, ctx)
    handlers.onStopped()
  })

  recorder.start(CHUNK_MS)

  const stop = (): Promise<void> => {
    if (stopped || recorder.state === "inactive") return Promise.resolve()
    return new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true })
      recorder.stop()
    })
  }

  const abort = async (): Promise<void> => {
    try {
      await stop()
    } catch {
      teardown(systemStream, micStream, ctx)
    }
  }

  return { stop, abort }
}

function teardown(system: MediaStream, mic: MediaStream, ctx: AudioContext): void {
  system.getTracks().forEach((t) => t.stop())
  mic.getTracks().forEach((t) => t.stop())
  void ctx.close().catch(() => {})
}
