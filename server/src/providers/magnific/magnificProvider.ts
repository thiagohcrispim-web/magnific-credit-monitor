import type { BalanceSnapshot, CostEstimate, CreationRecord, FileType, Provider } from "../types.js";
import { callTool } from "./mcpClient.js";
import { baseCostFor } from "../../calc/costTable.js";

interface AccountBalanceResponse {
  credits: { spent: number; available: number; totalPlan: number };
}

interface CreationsSearchResponse {
  items: Record<string, unknown>[];
  pagination: { total: number; page: number; perPage: number };
}

function mapFileType(raw: unknown): FileType {
  if (raw === "video") return "video";
  if (raw === "audio") return "audio";
  return "image";
}

function toCreationRecord(item: Record<string, unknown>): CreationRecord {
  const metadata = (item.metadata as Record<string, unknown>) ?? {};
  return {
    id: item.identifier as string,
    createdAt: item.createdAt as string,
    fileType: mapFileType(item.fileType ?? metadata.fileType),
    toolName: item.tool as string | undefined,
    model: (metadata.mode as string) ?? (metadata.slug as string) ?? undefined,
    projectReference: item.projectReference as string | undefined,
    resolution: metadata.resolution as string | undefined,
    durationSeconds: metadata.duration as number | undefined,
    webUrl: item.webUrl as string | undefined,
    raw: item,
  };
}

export class MagnificProvider implements Provider {
  readonly id: string;

  constructor(accountId: string) {
    this.id = accountId;
  }

  async getBalance(): Promise<BalanceSnapshot> {
    const res = await callTool<AccountBalanceResponse>(this.id, "account_balance", {});
    return {
      takenAt: new Date().toISOString(),
      spent: res.credits.spent,
      available: res.credits.available,
      totalPlan: res.credits.totalPlan,
    };
  }

  async listCreationsSince(sinceIso: string | undefined): Promise<CreationRecord[]> {
    const all: CreationRecord[] = [];
    let page = 1;
    const perPage = 50;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await callTool<CreationsSearchResponse>(this.id, "creations_search", {
        full: true,
        page,
        perPage,
        dateStart: sinceIso,
        orderBy: "created_at",
        orderDirection: "asc",
      });
      const items = res.items ?? [];
      all.push(...items.map(toCreationRecord));
      if (items.length < perPage) break;
      page++;
      if (page > 200) break; // guarda-corpo contra loop infinito
    }
    return all;
  }

  async listProjects(): Promise<{ reference: string; name: string }[]> {
    const res = await callTool<{ items: { reference: string; name: string }[] }>(this.id, "folders_list", {});
    return (res.items ?? []).map((f) => ({ reference: f.reference, name: f.name }));
  }

  async estimateCost(creation: CreationRecord): Promise<CostEstimate | undefined> {
    const toolMap: Record<FileType, string> = {
      image: "images_generate",
      video: "video_generate",
      audio: "audio_tts",
    };
    const tool = toolMap[creation.fileType];
    try {
      const args: Record<string, unknown> = { mode: creation.model };
      if (creation.durationSeconds) args.duration = creation.durationSeconds;
      if (creation.resolution) args.resolution = creation.resolution;
      const res = await callTool<{ credits?: number; estimatedCredits?: number }>(this.id, "simulate_cost", {
        tool,
        arguments: args,
      });
      const credits = res.credits ?? res.estimatedCredits;
      if (typeof credits === "number") return { credits, layer: "simulate_cost" };
    } catch {
      // cai para a camada manual abaixo
    }
    const fallback = baseCostFor(creation.fileType, creation.model, creation.toolName);
    return { credits: fallback.credits, layer: fallback.layer };
  }
}
