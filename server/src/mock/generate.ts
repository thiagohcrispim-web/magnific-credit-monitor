import type { Client } from "@libsql/client";
import { baseCostFor } from "../calc/costTable.js";
import type { FileType } from "../providers/types.js";

const IMAGE_MODELS = [
  "imagen-nano-banana-2-flash",
  "seedream-4-5",
  "flux-dev",
  "ideogram-4-5",
];
const VIDEO_MODELS = ["kling-2.1", "veo-3", "runway-gen4"];
const AUDIO_MODELS = ["elevenlabs-tts", "audio-music-generate"];

const PROJECTS = [
  { reference: "3484ba70-75e1-454d-9189-a0a26ffd03b7", name: "Dpaschoal" },
  { reference: "da7077ff-9b51-4a30-bf77-86779101828e", name: "Sandeleh" },
  { reference: "3473ede8-218e-4e91-8c5d-8ae36a733a63", name: "N1 - SIKA" },
  { reference: "5f63bb95-271a-4a18-90f7-b2cf0f515697", name: "CONTINENTAL" },
  { reference: "27aa3822-b53b-4684-a324-aa562f48b6b4", name: "Arcelor Mittal" },
  { reference: "f5e76662-3289-4086-b0fa-4c30a5b3f3cf", name: "MAKER" },
  { reference: "8e1bf91b-ef21-486c-b174-b57cdddcd43f", name: "Personal" },
];

interface CycleSpec {
  startAt: Date;
  endAt: Date;
  totalPlan: number;
  endSpent: number;
  counts: { image: number; video: number; audio: number };
  renewalDay: number;
}

interface AccountSpec {
  id: string;
  label: string;
  renewalDay: number;
  cycles: CycleSpec[];
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// PRNG determinístico (mulberry32) para o mock ser reproduzível.
function makeRng(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSpecs(): AccountSpec[] {
  return [
    {
      id: "nucleo01",
      label: "nucleo01 (trabalho)",
      renewalDay: 6,
      cycles: [
        {
          startAt: new Date("2026-09-06T00:00:00Z"),
          endAt: new Date("2026-10-06T00:00:00Z"),
          totalPlan: 300000,
          endSpent: 248500,
          counts: { image: 1500, video: 150, audio: 70 },
          renewalDay: 6,
        },
        {
          startAt: new Date("2026-10-06T00:00:00Z"),
          endAt: new Date("2026-11-05T00:00:00Z"),
          totalPlan: 300000,
          endSpent: 299997,
          counts: { image: 1883, video: 205, audio: 100 },
          renewalDay: 6,
        },
      ],
    },
    {
      id: "pessoal",
      label: "pessoal",
      renewalDay: 12,
      cycles: [
        {
          startAt: new Date("2026-09-12T00:00:00Z"),
          endAt: new Date("2026-10-12T00:00:00Z"),
          totalPlan: 300000,
          endSpent: 45200,
          counts: { image: 320, video: 15, audio: 8 },
          renewalDay: 12,
        },
        {
          startAt: new Date("2026-10-12T00:00:00Z"),
          endAt: new Date("2026-11-05T00:00:00Z"),
          totalPlan: 300000,
          endSpent: 61800,
          counts: { image: 410, video: 22, audio: 12 },
          renewalDay: 12,
        },
      ],
    },
  ];
}

function modelFor(fileType: FileType, rng: () => number): string {
  if (fileType === "image") return pick(IMAGE_MODELS, rng);
  if (fileType === "video") return pick(VIDEO_MODELS, rng);
  return pick(AUDIO_MODELS, rng);
}

function toolFor(fileType: FileType): string {
  if (fileType === "image") return "text-to-image";
  if (fileType === "video") return "video_generate";
  return "audio_tts";
}

export async function seedMockData(db: Client): Promise<void> {
  const rng = makeRng(42);
  const specs = buildSpecs();

  for (const account of specs) {
    await db.execute({
      sql: `INSERT INTO accounts (id, label, provider, renewal_day) VALUES (?, ?, 'magnific', ?)
            ON CONFLICT(id) DO UPDATE SET label=excluded.label, renewal_day=excluded.renewal_day`,
      args: [account.id, account.label, account.renewalDay],
    });
  }

  for (const project of PROJECTS) {
    await db.execute({
      sql: `INSERT INTO projects (reference, account_id, name) VALUES (?, ?, ?)
            ON CONFLICT(reference) DO NOTHING`,
      args: [project.reference, "nucleo01", project.name],
    });
  }

  for (const account of specs) {
    for (const cycle of account.cycles) {
      const creations: { createdAt: Date; fileType: FileType; model: string; tool: string; cost: number; project: string }[] = [];
      const spanMs = cycle.endAt.getTime() - cycle.startAt.getTime();

      for (const [fileType, count] of Object.entries(cycle.counts) as [FileType, number][]) {
        // Storyboards: imagens tendem a vir em clusters (muitas variações da mesma cena).
        let remaining = count;
        while (remaining > 0) {
          const clusterSize = fileType === "image" ? Math.min(remaining, 1 + Math.floor(rng() * 8)) : 1;
          const clusterTime = cycle.startAt.getTime() + rng() * spanMs;
          const project = pick(PROJECTS, rng).reference;
          for (let i = 0; i < clusterSize; i++) {
            const model = modelFor(fileType, rng);
            const base = baseCostFor(fileType, model).credits;
            const jitter = 0.7 + rng() * 0.6;
            creations.push({
              createdAt: new Date(clusterTime + i * 1500),
              fileType,
              model,
              tool: toolFor(fileType),
              cost: base * jitter,
              project,
            });
          }
          remaining -= clusterSize;
        }
      }

      creations.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const rawTotal = creations.reduce((s, c) => s + c.cost, 0);
      const targetSpentDelta = cycle.endSpent - (cycle.totalPlan - cycle.totalPlan); // = cycle.endSpent (ciclo começa em 0 gasto)
      const scale = rawTotal > 0 ? targetSpentDelta / rawTotal : 1;
      for (const c of creations) c.cost *= scale;

      // Snapshots: a cada ~6h, spent acumulado = soma das criações até aquele instante.
      const snapshotStep = 6 * 60 * 60 * 1000;
      const snapshotTimes: number[] = [];
      for (let t = cycle.startAt.getTime(); t <= cycle.endAt.getTime(); t += snapshotStep) {
        snapshotTimes.push(t);
      }
      if (snapshotTimes[snapshotTimes.length - 1] !== cycle.endAt.getTime()) {
        snapshotTimes.push(cycle.endAt.getTime());
      }

      let creationCursor = 0;
      let cumulativeCost = 0;
      const snapshotIds: number[] = [];
      for (const t of snapshotTimes) {
        while (creationCursor < creations.length && creations[creationCursor].createdAt.getTime() <= t) {
          cumulativeCost += creations[creationCursor].cost;
          creationCursor++;
        }
        const spent = Math.round(Math.min(cumulativeCost, cycle.endSpent));
        const res = await db.execute({
          sql: `INSERT INTO snapshots (account_id, taken_at, spent, available, total_plan) VALUES (?, ?, ?, ?, ?)`,
          args: [account.id, new Date(t).toISOString(), spent, cycle.totalPlan - spent, cycle.totalPlan],
        });
        snapshotIds.push(Number(res.lastInsertRowid));
      }

      // Atribui cada criação ao intervalo [snapshot_i, snapshot_i+1] em que caiu.
      let idx = 0;
      for (let i = 0; i < creations.length; i++) {
        const c = creations[i];
        while (idx < snapshotTimes.length - 1 && snapshotTimes[idx + 1] < c.createdAt.getTime()) idx++;
        const fromId = snapshotIds[idx];
        const toId = snapshotIds[Math.min(idx + 1, snapshotIds.length - 1)];
        const id = `${account.id}-${cycle.startAt.getTime()}-${i}`;
        await db.execute({
          sql: `INSERT INTO creations (
                  id, account_id, created_at, file_type, tool_name, model, project_reference,
                  estimated_cost, cost_layer, attributed_cost, confidence,
                  snapshot_from_id, snapshot_to_id, web_url, raw_metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'model_table', ?, 1.0, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING`,
          args: [
            id,
            account.id,
            c.createdAt.toISOString(),
            c.fileType,
            c.tool,
            c.model,
            c.project,
            c.cost,
            c.cost,
            fromId,
            toId,
            `https://magnific.com/creation/${id}`,
            JSON.stringify({ mock: true }),
          ],
        });
      }

      await db.execute({
        sql: `INSERT INTO cycles (account_id, start_at, end_at, start_spent, end_spent, detected_by)
              VALUES (?, ?, ?, 0, ?, 'renewal_day')`,
        args: [account.id, cycle.startAt.toISOString(), cycle.endAt.toISOString(), cycle.endSpent],
      });
    }
  }
}
