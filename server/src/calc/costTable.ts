import type { FileType } from "../providers/types.js";

/**
 * Camada 2 (tabela manual por modelo) e fallback de camadas 3/4.
 * Usada quando `simulate_cost` falha ou não está disponível, e para gerar
 * o custo-base simulado dos dados mock.
 */
export const modelCostTable: Record<string, number> = {
  "imagen-nano-banana-2-flash": 40,
  "seedream-4-5": 60,
  "flux-dev": 35,
  "ideogram-4-5": 90,
  "kling-2.1": 900,
  "veo-3": 1200,
  "runway-gen4": 700,
  "elevenlabs-tts": 20,
  "audio-music-generate": 150,
};

export const toolCostTable: Record<string, number> = {
  "text-to-image": 50,
  images_variations: 45,
  images_upscale: 60,
  video_generate: 850,
  video_upscale: 300,
  audio_tts: 25,
  audio_music_generate: 150,
  audio_sfx_generate: 40,
};

export const fileTypeCostTable: Record<FileType, number> = {
  image: 50,
  video: 850,
  audio: 60,
};

export function baseCostFor(
  fileType: FileType,
  model?: string,
  toolName?: string
): { credits: number; layer: "model_table" | "tool_table" | "file_type_table" } {
  if (model && modelCostTable[model] !== undefined) {
    return { credits: modelCostTable[model], layer: "model_table" };
  }
  if (toolName && toolCostTable[toolName] !== undefined) {
    return { credits: toolCostTable[toolName], layer: "tool_table" };
  }
  return { credits: fileTypeCostTable[fileType], layer: "file_type_table" };
}
