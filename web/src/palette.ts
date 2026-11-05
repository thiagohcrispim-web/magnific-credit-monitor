// Paleta validada (skill dataviz) — oito matizes categóricas em ordem fixa, modo escuro.
export const categorical = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
  "#9085e9", // 7 violet
  "#e66767", // 8 red
];

export const fileTypeColor: Record<string, string> = {
  image: categorical[0],
  video: categorical[1],
  audio: categorical[2],
};

export const status = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const ink = {
  surface: "#1a1a19",
  page: "#0d0d0d",
  primary: "#f0efec",
  secondary: "#c3c2b7",
  muted: "#898781",
  grid: "#2c2c2a",
  baseline: "#383835",
};

export function colorFor(index: number): string {
  return categorical[index % categorical.length];
}
