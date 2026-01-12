import { spawn } from "node:child_process"
import { rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { updatePostWaveformUrl } from "../../db/posts"
import { downloadFromR2, uploadToR2 } from "../../lib/r2"
import type { GenerateWaveformData, JobParams, JobRunner } from "./types"

const WAVEFORM_WIDTH = 300
const WAVEFORM_HEIGHT = 60
const WAVEFORM_SAMPLES = 150
const WAVEFORM_COLOR = { r: 233, g: 69, b: 96 }

/**
 * Extract amplitude samples from audio by analyzing raw PCM data
 */
async function extractAmplitudesFromRaw(
  audioPath: string,
  numSamples: number,
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      audioPath,
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-",
    ]

    const ffmpeg = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] })

    const chunks: Buffer[] = []
    ffmpeg.stdout.on("data", (data) => {
      chunks.push(data)
    })

    let stderr = ""
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`))
        return
      }

      const buffer = Buffer.concat(chunks)
      const samples = new Int16Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.length / 2,
      )

      if (samples.length === 0) {
        resolve(generateFallbackAmplitudes(numSamples))
        return
      }

      // Calculate number of samples per waveform point
      const samplesPerPoint = Math.floor(samples.length / numSamples)
      const amplitudes: number[] = []

      for (let i = 0; i < numSamples; i++) {
        const start = i * samplesPerPoint
        const end = Math.min(start + samplesPerPoint, samples.length)

        // Calculate peak amplitude for this segment
        let peak = 0
        for (let j = start; j < end; j++) {
          const value = Math.abs(samples[j]!) / 32768
          if (value > peak) peak = value
        }

        amplitudes.push(peak)
      }

      // Normalize amplitudes
      const maxAmplitude = Math.max(...amplitudes, 0.01)
      resolve(amplitudes.map((a) => a / maxAmplitude))
    })

    ffmpeg.on("error", reject)
  })
}

/**
 * Generate fallback amplitudes when audio processing fails
 */
function generateFallbackAmplitudes(numSamples: number): number[] {
  const amplitudes: number[] = []
  for (let i = 0; i < numSamples; i++) {
    amplitudes.push(0.3 + Math.random() * 0.4)
  }
  return amplitudes
}

/**
 * Render waveform amplitudes to PNG buffer
 */
function renderWaveformToPng(
  amplitudes: number[],
  width: number,
  height: number,
): Buffer {
  const barWidth = Math.max(1, Math.floor(width / amplitudes.length) - 1)
  const gap = 1
  const actualWidth = amplitudes.length * (barWidth + gap)

  // Create raw RGBA pixel buffer
  const pixels = Buffer.alloc(actualWidth * height * 4, 0)

  const centerY = Math.floor(height / 2)

  for (let i = 0; i < amplitudes.length; i++) {
    const x = i * (barWidth + gap)
    const amplitude = amplitudes[i]!
    const barHeight = Math.max(2, Math.floor(amplitude * (height - 4)))
    const halfHeight = Math.floor(barHeight / 2)

    // Draw symmetric bar from center
    for (let dy = -halfHeight; dy <= halfHeight; dy++) {
      const y = centerY + dy
      if (y >= 0 && y < height) {
        for (let bx = 0; bx < barWidth; bx++) {
          const pixelIndex = (y * actualWidth + x + bx) * 4
          pixels[pixelIndex] = WAVEFORM_COLOR.r
          pixels[pixelIndex + 1] = WAVEFORM_COLOR.g
          pixels[pixelIndex + 2] = WAVEFORM_COLOR.b
          pixels[pixelIndex + 3] = 255
        }
      }
    }
  }

  // Encode as PNG manually (simple implementation)
  return encodePng(pixels, actualWidth, height)
}

/**
 * Simple PNG encoder for RGBA data
 */
function encodePng(pixels: Buffer, width: number, height: number): Buffer {
  const { deflateSync } = require("node:zlib")

  // PNG signature
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])

  // IHDR chunk
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type: RGBA
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace

  const ihdrChunk = createPngChunk("IHDR", ihdrData)

  // IDAT chunk - raw image data with filter bytes
  const rowSize = width * 4
  const rawData = Buffer.alloc(height * (1 + rowSize))

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowSize)
    rawData[rowOffset] = 0 // filter type: none
    pixels.copy(rawData, rowOffset + 1, y * rowSize, (y + 1) * rowSize)
  }

  const compressedData = deflateSync(rawData, { level: 9 })
  const idatChunk = createPngChunk("IDAT", compressedData)

  // IEND chunk
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

/**
 * Create a PNG chunk with CRC
 */
function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const typeBuffer = Buffer.from(type, "ascii")
  const crcInput = Buffer.concat([typeBuffer, data])
  const crc = crc32(crcInput)

  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc, 0)

  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

/**
 * Calculate CRC32 for PNG chunks
 */
function crc32(data: Buffer): number {
  // CRC32 lookup table
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1)
      } else {
        c = c >>> 1
      }
    }
    table[n] = c
  }

  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

export const run: JobRunner = async (params: JobParams) => {
  const { serverApp, log, job } = params
  const data = job.data as GenerateWaveformData

  if (!data.postId || !data.audioKey) {
    log.error("Invalid job data: missing postId or audioKey")
    return
  }

  log.info(`Generating waveform for post ${data.postId}`)

  const tempDir = tmpdir()
  const audioPath = join(tempDir, `audio-${data.postId}-${Date.now()}`)
  const waveformKey = `waveforms/${data.postId}.png`

  try {
    // Download audio from R2
    log.debug(`Downloading audio from R2: ${data.audioKey}`)
    const audioBuffer = await downloadFromR2(log, data.audioKey)

    // Write to temp file
    await writeFile(audioPath, Buffer.from(audioBuffer))

    // Extract amplitudes
    log.debug("Extracting amplitudes from audio")
    let amplitudes: number[]
    try {
      amplitudes = await extractAmplitudesFromRaw(audioPath, WAVEFORM_SAMPLES)
    } catch (error) {
      log.warn("Failed to extract amplitudes, using fallback", { error })
      amplitudes = generateFallbackAmplitudes(WAVEFORM_SAMPLES)
    }

    // Render waveform PNG
    log.debug("Rendering waveform PNG")
    const pngBuffer = renderWaveformToPng(
      amplitudes,
      WAVEFORM_WIDTH,
      WAVEFORM_HEIGHT,
    )

    // Upload to R2
    log.debug(`Uploading waveform to R2: ${waveformKey}`)
    const waveformUrl = await uploadToR2(
      log,
      waveformKey,
      pngBuffer,
      "image/png",
    )

    // Update post record
    log.debug(`Updating post ${data.postId} with waveform URL`)
    await updatePostWaveformUrl(serverApp.db, data.postId, waveformUrl)

    log.info(`Waveform generated successfully for post ${data.postId}`)
  } finally {
    // Clean up temp file
    try {
      await rm(audioPath, { force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

export const generateWaveformJob = {
  run,
}
