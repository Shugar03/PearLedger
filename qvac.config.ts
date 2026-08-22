/**
 * QVAC runtime config — PearLedger
 * @see https://docs.qvac.tether.io/js-ts-sdk/
 *
 * ctx_size ≥ 4096 es obligatorio para facturas largas (default 1024 trunca).
 */
export default {
  ctxSize: 4096,
  models: {
    llm: {
      path: './models/qwen3-1.7b-q4_0.bin',
      modelType: 'llamacpp-completion',
    },
    ocr: {
      path: './models/ocr-3b-multimodal-q4_0.bin',
      modelType: 'ggmlOcr',
    },
    embeddings: {
      path: './models/gte-large-fp16.bin',
      modelType: 'llamacpp-embedding',
    },
  },
  rag: {
    workspace: './workspace/purchase-orders',
    embeddingModel: 'GTE_LARGE_FP16',
  },
}
