/** Runs in either inert linkedom or the logged-in browser. No scripts, data eval, or private fields. */
export function extractListFacts(document: Document) {
  const clean = (s: string | null | undefined) =>
    (s ?? "").replace(/\s+/g, " ").trim();
  const attr = (e: Element | null, key: string) => e?.getAttribute(key) ?? null;
  const pager = document.querySelector(".pagination");
  const pagerText = clean(pager?.textContent?.replace(/function[\s\S]*/, ""));
  const count = (pattern: RegExp) => {
    const m = pagerText.match(pattern);
    return m ? Number(m[1]) : null;
  };
  const cards = Array.from(document.querySelectorAll(".details > dl")).map(
    (card) => {
      const cells = Array.from(card.querySelectorAll(".planItem[data]")).map(
        (cell) => {
          const data = attr(cell, "data") ?? "";
          // Exactly the observed literal grammar; never evaluate arbitrary page text.
          const m = data.match(
            /^\s*\{\s*'id'\s*:\s*'([^'\\\r\n]{1,128})'\s*,\s*'staTime'\s*:\s*'(\d{2}:\d{2})'\s*,\s*'endTime'\s*:\s*'(\d{2}:\d{2})'\s*,\s*'date'\s*:\s*'(\d{4}-\d{2}-\d{2})'\s*\}\s*$/,
          );
          const colors = Array.from(cell.classList).filter((c) =>
            ["green", "red", "red1", "yellow", "gray"].includes(c),
          );
          return {
            id: m?.[1] ?? null,
            start: m?.[2] ?? null,
            end: m?.[3] ?? null,
            date: m?.[4] ?? null,
            color: colors.length === 1 ? colors[0] : "unknown",
            valid: !!m,
          };
        },
      );
      // Exact observed card labels only. Never retain unrelated list text or contacts.
      const details = Array.from(card.querySelectorAll("ol li"));
      const capacities = details.map((li) => clean(li.textContent))
        .filter((value) => /^容纳人数\s*[：:]/.test(value));
      const facilities = details.filter((li) => li.classList.contains("ptss"))
        .map((li) => clean(li.textContent))
        .filter((value) => /^配套设施\s*[：:]/.test(value));
      const match = capacities.length === 1
        ? capacities[0].match(/^容纳人数\s*[：:]\s*([1-9]\d{0,3}|10000)\s*$/) : null;
      const equipment = facilities.length === 1 && facilities[0].length <= 1300
        ? facilities[0].replace(/^配套设施\s*[：:]\s*/, "").split(/[,，、]/)
            .map((value) => value.trim()).filter(Boolean) : [];
      const amenities = equipment.length <= 30 && equipment.every((value) => value.length <= 40)
        ? Array.from(new Set(equipment)) : [];
      return {
        name: clean(card.querySelector("ol li:first-child")?.textContent),
        floor: clean(card.querySelector(".louceng")?.textContent),
        state: clean(card.querySelector(".zhuangtai")?.textContent),
        visible: attr(card, "data-visible"),
        blocked: attr(card, "data-isnotbooking"),
        capacity: match ? Number(match[1]) : 0,
        amenities,
        cells,
      };
    },
  );
  const placeOptions = Array.from(
    document.querySelectorAll("#MEETING_PLACE option"),
  ).map((e) => ({ id: attr(e, "value"), name: clean(e.textContent) }));
  return {
    login: !!document.querySelector("input[type=password]"),
    base: attr(document.querySelector("base"), "href"),
    formAction: attr(document.querySelector("#Form"), "action"),
    formMethod: attr(document.querySelector("#Form"), "method")?.toLowerCase(),
    date: attr(
      document.querySelector("#Form #MEETING_DATE,#Form #BOOKING_DATE"),
      "value",
    ),
    total: count(/共\s*(\d+)\s*条/),
    pages: count(/共\s*(\d+)\s*页/),
    currentPage:
      Number(clean(pager?.querySelector("li.active")?.textContent)) || null,
    pageSize:
      Number(
        attr(
          pager?.querySelector("select[name=showCount] option[selected]") ??
            null,
          "value",
        ),
      ) || null,
    cards,
    placeOptions,
  };
}
export type ListFacts = ReturnType<typeof extractListFacts>;
