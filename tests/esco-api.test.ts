import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {} }));

const { relevance, searchEsco, toSubset, getOccupation } = await import("@/lib/esco-api");

const OCC = "http://data.europa.eu/esco/occupation/2f5de1ab-eddf-4715-8193-e994912c22ea";
const PYTHON = "http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d";

/** Fake ESCO: per-language search results plus English labels by URI. */
function mockEsco(
  results: Record<string, { uri: string; title: string }[]>,
  en: Record<string, string> = {},
) {
  const fetchMock = vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname.endsWith("/search")) {
      const lang = u.searchParams.get("language")!;
      return Response.json({
        _embedded: {
          results: results[lang] ?? [{ uri: "junk:" + lang, title: "aircraft de-icer installer" }],
        },
      });
    }
    const uri = u.searchParams.get("uri")!;
    return Response.json({ preferredLabel: { en: en[uri] ?? uri } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("relevance", () => {
  it("scores labels by how much of the query they contain", () => {
    expect(relevance("lagerchef", "lagerchef")).toBe(1);
    expect(relevance("jefe de almacén", "jefe de almacén/jefa de almacén")).toBe(1);
    expect(relevance("Jefe de Almacen", "jefe de almacén de cueros acabados")).toBe(0.9);
    expect(relevance("ingeniero de datos", "ingeniero mecánico")).toBe(0.5);
    expect(relevance("lagerchef", "aircraft de-icer installer")).toBe(0);
  });
});

describe("linking ESCO concepts to the event's skill set", () => {
  it("links by exact URI first, then by keyword as a close match", () => {
    expect(toSubset(PYTHON, "Python (computer programming)")).toEqual({ id: "python", via: "uri" });
    expect(toSubset("http://data.europa.eu/esco/skill/x", "manage a warehouse management system")).toEqual({
      id: "logistics",
      via: "keyword",
    });
    expect(toSubset("http://data.europa.eu/esco/skill/y", "show confidence")).toBeUndefined();
  });
});

describe("multilingual ESCO search", () => {
  it("merges languages, drops fuzzy junk and returns English titles", async () => {
    mockEsco({ sv: [{ uri: OCC, title: "lagerchef" }] }, { [OCC]: "warehouse manager" });
    const hits = await searchEsco("lagerchef", "occupation");
    expect(hits).toEqual([{ uri: OCC, matched: "lagerchef", language: "sv", title: "warehouse manager" }]);
  });

  it("only sends the typed text and public URIs to ESCO", async () => {
    const f = mockEsco({ en: [{ uri: PYTHON, title: "Python (computer programming)" }] });
    await searchEsco("python", "skill");
    for (const [url] of f.mock.calls) {
      const u = new URL(url as string);
      expect(u.origin).toBe("https://ec.europa.eu");
      expect(
        [...u.searchParams.keys()].every((k) =>
          ["text", "type", "language", "limit", "full", "uri"].includes(k),
        ),
      ).toBe(true);
    }
  });

  it("throws when every language fails, so callers can say ESCO is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 503 })),
    );
    await expect(searchEsco("python", "skill")).rejects.toThrow(/unreachable/);
  });
});

describe("occupation details", () => {
  it("returns labels and essential skills linked to the event's skills", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          uri: OCC,
          preferredLabel: { en: "warehouse manager", fi: "varaston johtaja", sv: "lagerchef" },
          description: { en: { literal: "Warehouse managers…" } },
          _links: {
            hasEssentialSkill: [
              { uri: PYTHON, title: "Python (computer programming)" },
              { uri: "http://data.europa.eu/esco/skill/z", title: "schedule shifts" },
            ],
          },
        }),
      ),
    );
    const o = await getOccupation(OCC);
    expect(o.labels).toEqual({ en: "warehouse manager", fi: "varaston johtaja", sv: "lagerchef" });
    expect(o.essential[0].subset).toEqual({ id: "python", via: "uri" });
    expect(o.essential[1].subset).toBeUndefined();
    expect(o.url).toContain(encodeURIComponent(OCC).slice(0, 0) + OCC);
  });
});
