import { describe, expect, it } from "vitest";
import { crossedThresholds, parseEmails } from "./alerts.js";

describe("alertas", () => {
  it("detecta limiares cruzados", () => {
    expect(crossedThresholds(50)).toEqual([]);
    expect(crossedThresholds(30)).toEqual([30]);
    expect(crossedThresholds(8)).toEqual([30, 10]);
  });
  it("normaliza a lista de e-mails", () => {
    expect(parseEmails("A@x.com, b@y.com\nlixo; a@x.com")).toEqual(["a@x.com", "b@y.com"]);
  });
});
