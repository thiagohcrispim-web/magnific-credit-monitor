import { describe, expect, it } from "vitest";
import { baseCostFor } from "../../calc/costTable.js";

// Fixture anonimizada baseada no formato real confirmado em docs/mcp-findings.md
// (creations_search com full=true).
const sampleCreationItem = {
  identifier: "00000000-0000-0000-0000-000000000001",
  name: "cena-01-v3",
  tool: "text-to-image",
  status: "completed",
  createdAt: "2026-11-05T15:23:42+00:00",
  fileReference: "00000000-0000-0000-0000-000000000002",
  folderReference: "00000000-0000-0000-0000-000000000003",
  projectReference: "00000000-0000-0000-0000-000000000003",
  webUrl: "https://magnific.com/creation/00000000-0000-0000-0000-000000000001",
  metadata: {
    mode: "imagen-nano-banana-2-flash",
    modelName: "Google Nano Banana 2",
    width: 2048,
    height: 2048,
    resolution: "2k",
    prompt: "cena de storyboard, variação 3",
    seed: 123456,
  },
};

describe("formato real de creations_search (full=true)", () => {
  it("tem os campos necessários para atribuição: createdAt, modelo, tool", () => {
    expect(sampleCreationItem.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(sampleCreationItem.metadata.mode).toBe("imagen-nano-banana-2-flash");
    expect(sampleCreationItem.tool).toBe("text-to-image");
  });

  it("não tem nenhum campo de custo (confirma a restrição central do brief)", () => {
    const keys = Object.keys(sampleCreationItem).concat(Object.keys(sampleCreationItem.metadata));
    expect(keys).not.toContain("cost");
    expect(keys).not.toContain("credits");
    expect(keys).not.toContain("price");
  });
});

describe("baseCostFor (camada 2 — fallback quando simulate_cost falha)", () => {
  it("usa a tabela de modelo quando o modelo é conhecido", () => {
    const result = baseCostFor("image", "imagen-nano-banana-2-flash", "text-to-image");
    expect(result.layer).toBe("model_table");
    expect(result.credits).toBeGreaterThan(0);
  });

  it("cai para a tabela de ferramenta quando o modelo é desconhecido", () => {
    const result = baseCostFor("video", "modelo-novo-desconhecido", "video_generate");
    expect(result.layer).toBe("tool_table");
  });

  it("cai para a tabela de tipo de arquivo quando nem modelo nem ferramenta são conhecidos", () => {
    const result = baseCostFor("audio", undefined, undefined);
    expect(result.layer).toBe("file_type_table");
    expect(result.credits).toBeGreaterThan(0);
  });
});
