import { describe, expect, it } from "vitest";
import { cleanContact, contactProblem, EMPTY_CONTACT } from "@/lib/contact";

const ok = { fullName: "Alex Virtanen", email: "alex@example.com", phone: "", city: "" };

describe("contactProblem", () => {
  it("requires a name and a valid email", () => {
    expect(contactProblem(EMPTY_CONTACT)).toMatch(/name/);
    expect(contactProblem({ ...ok, email: "alex@" })).toMatch(/email/);
    expect(contactProblem(ok)).toBe("");
  });

  it("accepts an empty phone but rejects a malformed one", () => {
    expect(contactProblem({ ...ok, phone: "+358 40 123 4567" })).toBe("");
    expect(contactProblem({ ...ok, phone: "call me" })).toMatch(/phone/);
  });
});

describe("cleanContact", () => {
  it("trims and normalises before saving", () => {
    expect(
      cleanContact({
        fullName: "  Alex   Virtanen ",
        email: " Alex@Example.com ",
        phone: " 040 ",
        city: " Espoo ",
      }),
    ).toEqual({
      fullName: "Alex Virtanen",
      email: "alex@example.com",
      phone: "040",
      city: "Espoo",
    });
  });
});
