/**
 * QVAC model lifecycle — carga singleton, reutiliza entre tools.
 */

import {
  close,
  loadModel,
  unloadModel,
  OCR_3B_MULTIMODAL_Q4_0,
  MMPROJ_OCR_3B_MULTIMODAL_F16,
  QWEN3_1_7B_INST_Q4,
  GTE_LARGE_FP16
} from '@qvac/sdk'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

let ocrModelId: string | null = null
let llmModelId: string | null = null
let embeddingModelId: string | null = null

function qvacHome(): string {
  return process.env.QVAC_HOME || path.join(os.homedir(), '.qvac')
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Drop stale `.worker.lock` left behind when Bare worker crashes on Windows. */
export function clearStaleWorkerLock(): void {
  const lockPath = path.join(qvacHome(), '.worker.lock')
  try {
    if (!fs.existsSync(lockPath)) return
    const raw = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: number }
    if (typeof raw.pid === 'number' && isPidAlive(raw.pid)) return
    fs.unlinkSync(lockPath)
    console.warn(`[qvac] removed stale worker lock (${raw.pid ?? 'unknown'})`)
  } catch {
    // best-effort
  }
}

export async function getOcrModelId(): Promise<string> {
  if (ocrModelId) return ocrModelId

  clearStaleWorkerLock()
  ocrModelId = await loadModel({
    modelSrc: OCR_3B_MULTIMODAL_Q4_0,
    modelConfig: {
      ctx_size: CTX_SIZE,
      projectionModelSrc: MMPROJ_OCR_3B_MULTIMODAL_F16
    }
  })
  return ocrModelId
}

export async function getLlmModelId(): Promise<string> {
  if (llmModelId) return llmModelId

  clearStaleWorkerLock()
  llmModelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: CTX_SIZE }
  })
  return llmModelId
}

export async function getEmbeddingModelId(): Promise<string> {
  if (embeddingModelId) return embeddingModelId

  clearStaleWorkerLock()
  embeddingModelId = await loadModel(
    { modelSrc: GTE_LARGE_FP16 },
    { timeout: 180_000 }
  )
  return embeddingModelId
}

/**
 * After a Bare worker crash, cached model IDs are dead and fd locks linger.
 * Close RPC + clear cache so Path A / retry can spawn a fresh worker.
 */
export async function resetQvacRuntime(): Promise<void> {
  const ids = [ocrModelId, llmModelId, embeddingModelId].filter(Boolean) as string[]
  ocrModelId = null
  llmModelId = null
  embeddingModelId = null

  for (const modelId of ids) {
    try {
      await unloadModel({ modelId, autoClose: false })
    } catch {
      // worker may already be dead
    }
  }

  try {
    await close()
  } catch {
    // ignore
  }

  clearStaleWorkerLock()
}
