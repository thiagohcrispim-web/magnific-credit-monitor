export type FileType = "image" | "video" | "audio";

export interface BalanceSnapshot {
  takenAt: string; // ISO 8601
  spent: number;
  available: number;
  totalPlan: number;
}

export interface CreationRecord {
  id: string;
  createdAt: string; // ISO 8601
  fileType: FileType;
  toolName?: string;
  model?: string;
  projectReference?: string;
  projectName?: string;
  resolution?: string;
  durationSeconds?: number;
  webUrl?: string;
  raw: Record<string, unknown>;
}

export interface CostEstimate {
  credits: number;
  layer: "simulate_cost" | "model_table" | "tool_table" | "file_type_table";
}

/**
 * Isola a coleta de um provedor de IA (Magnific hoje; Claude/Codex depois)
 * atrás desta interface, para reuso num app maior de monitoramento de uso de IA.
 */
export interface Provider {
  readonly id: string;
  getBalance(): Promise<BalanceSnapshot>;
  /** Busca criações criadas estritamente depois de `sinceIso`, paginando até o fim. */
  listCreationsSince(sinceIso: string | undefined): Promise<CreationRecord[]>;
  listProjects(): Promise<{ reference: string; name: string }[]>;
  estimateCost(creation: CreationRecord): Promise<CostEstimate | undefined>;
}
