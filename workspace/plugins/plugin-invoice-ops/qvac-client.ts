/**
 * QVAC model lifecycle — carga lazy por rol.
 * Importante: el runtime puede desalojar un modelo al cargar otro;
 * por eso invalidamos el cache hermano al (re)cargar.
 */

import {
  loadModel,
  OCR_3B_MULTIMODAL_Q4_0,
  MMPROJ_OCR_3B_MULTIMODAL_Q8_0,
  QWEN3_1_7B_INST_Q4,
  GTE_LARGE_FP16
} from '@qvac/sdk'

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

let ocrModelId: string | null = null
let llmModelId: string | null = null
let embeddingModelId: string | null = null

export function resetQvacModelCache(): void {
  ocrModelId = null
  llmModelId = null
  embeddingModelId = null
}

export async function getOcrModelId(): Promise<string> {
  if (ocrModelId) return ocrModelId

  // Cargar OCR puede desalojar LLM / embeddings en memoria
  llmModelId = null
  embeddingModelId = null

  ocrModelId = await loadModel({
    modelSrc: OCR_3B_MULTIMODAL_Q4_0,
    modelConfig: {
      ctx_size: CTX_SIZE,
      projectionModelSrc: MMPROJ_OCR_3B_MULTIMODAL_Q8_0
    }
  })
  return ocrModelId
}

export async function getLlmModelId(): Promise<string> {
  if (llmModelId) return llmModelId

  ocrModelId = null
  embeddingModelId = null

  llmModelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: CTX_SIZE }
  })
  return llmModelId
}

export async function getEmbeddingModelId(): Promise<string> {
  if (embeddingModelId) return embeddingModelId

  ocrModelId = null
  llmModelId = null

  embeddingModelId = await loadModel(
    { modelSrc: GTE_LARGE_FP16 },
    { timeout: 180_000 }
  )
  return embeddingModelId
}
