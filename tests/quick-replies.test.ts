import { describe, expect, it } from "vitest";
import { cleanQuickReplies, QUICK_REPLY_MAX } from "@/lib/intake";

describe("cleanQuickReplies", () => {
  it("trims, unquotes and dedupes case-insensitively", () => {
    expect(
      cleanQuickReplies(['  "Python is a must"  ', "python is a must!", "Hybrid, 2 days a week"]),
    ).toEqual(["Python is a must", "Hybrid, 2 days a week"]);
  });

  it("drops non-strings, empty, over-long and echo-of-last-message items", () => {
    const long = "x".repeat(QUICK_REPLY_MAX + 1);
    expect(cleanQuickReplies([1, "", long, "We need a dev", "Back-end APIs"], "we need a dev")).toEqual([
      "Back-end APIs",
    ]);
  });

  it("returns at most four and handles junk input", () => {
    expect(cleanQuickReplies(["a", "b", "c", "d", "e"])).toHaveLength(4);
    expect(cleanQuickReplies(null)).toEqual([]);
  });
});
