/**
 * Worker principal: OCR + LLM via QVAC SDK.
 * Corre en proceso Bare separado del CLI one-shot.
 */

console.log('[worker:main] QVAC worker stub — OCR + LLM inference')

// TODO: import { loadModel, ocr, completion } from '@qvac/sdk'
// Modelo recomendado: QWEN3_1_7B (tool calling)
// OCR Path B: OCR_3B_MULTIMODAL_Q4_0

module.exports = { ready: true }
