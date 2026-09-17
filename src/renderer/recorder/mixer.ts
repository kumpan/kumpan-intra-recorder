export type RecordingSession = {
  stop: () => Promise<void>
  abort: () => Promise<void>
}

export type RecordingHandlers = {
  onChunk: (data: ArrayBuffer) => void
  onError: (message: string) => void
  onStopped: () => void
  onSilenceChange: (silent: boolean) => void
}

const CHUNK_MS = 1000
const MIME_TYPE = "audio/webm; codecs=opus"

const LEVEL_INTERVAL_MS = 1000
// About −48 dBFS: under the quietest speech a mic picks up, over the noise floor of a
// muted room, so "quiet" means nobody is talking on either channel.
const SILENCE_RMS = 0.004
// A pause between sentences is not silence. The flag only flips once the mix has been
// under the threshold this long; main decides how much quiet is worth interrupting for.
const SILENCE_HOLD_MS = 20_000

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
): { stream: MediaStream; output: AudioNode } {
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
  return { stream: dest.stream, output: merger }
}

// Taps the same mix that goes to the encoder. The analyser needs no output connection:
// it is pulled because the node feeding it already runs into the recording destination.
function watchSilence(
  ctx: AudioContext,
  output: AudioNode,
  onSilenceChange: (silent: boolean) => void
): () => void {
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  output.connect(analyser)

  const samples = new Float32Array(analyser.fftSize)
  let quietSince: number | null = null
  let silent = false

  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i] ?? 0
      sum += sample * sample
    }
    const rms = Math.sqrt(sum / samples.length)
    const now = Date.now()

    if (rms >= SILENCE_RMS) {
      quietSince = null
      if (silent) {
        silent = false
        onSilenceChange(false)
      }
      return
    }

    if (quietSince === null) quietSince = now
    if (!silent && now - quietSince >= SILENCE_HOLD_MS) {
      silent = true
      onSilenceChange(true)
    }
  }, LEVEL_INTERVAL_MS)

  return () => {
    clearInterval(interval)
    output.disconnect(analyser)
  }
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
  const stopSilenceWatch = watchSilence(
    ctx,
    mixed.output,
    handlers.onSilenceChange
  )

  const recorder = new MediaRecorder(mixed.stream, { mimeType: MIME_TYPE })
  let stopped = false

  recorder.addEventListener("dataavailable", (event) => {
    if (!event.data || event.data.size === 0) return
    event.data
      .arrayBuffer()
      .then((buf) => handlers.onChunk(buf))
      .catch((err: unknown) => {
        handlers.onError(
          err instanceof Error ? err.message : "Chunk read error."
        )
      })
  })

  recorder.addEventListener("error", (event) => {
    const err = (event as ErrorEvent).error
    handlers.onError(
      err instanceof Error ? err.message : "MediaRecorder error."
    )
  })

  recorder.addEventListener("stop", () => {
    stopped = true
    stopSilenceWatch()
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
      stopSilenceWatch()
      teardown(systemStream, micStream, ctx)
    }
  }

  return { stop, abort }
}

function teardown(
  system: MediaStream,
  mic: MediaStream,
  ctx: AudioContext
): void {
  system.getTracks().forEach((t) => t.stop())
  mic.getTracks().forEach((t) => t.stop())
  void ctx.close().catch(() => {})
}
