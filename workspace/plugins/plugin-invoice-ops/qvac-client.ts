/**
 * QVAC model lifecycle — carga singleton, reutiliza entre tools.
 */

import {
  loadModel,
  OCR_3B_MULTIMODAL_Q4_0,
  MMPROJ_OCR_3B_MULTIMODAL_F16,
  QWEN3_1_7B_INST_Q4
} from '@qvac/sdk'

const CTX_SIZE = Number(process.env.QVAC_CTX_SIZE || 4096)

let ocrModelId: string | null = null
let llmModelId: string | null = null

export async function getOcrModelId(): Promise<string> {
  if (ocrModelId) return ocrModelId

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

  llmModelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: { ctx_size: CTX_SIZE }
  })
  return llmModelId
}
