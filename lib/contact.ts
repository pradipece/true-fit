import type { TalentContact } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s()-]{6,20}$/;

export const EMPTY_CONTACT: TalentContact = { fullName: "", email: "", phone: "", city: "" };

/** What's wrong with a job seeker's personal details, or "" when they're fine. Name and email are required. */
export function contactProblem(c: TalentContact) {
  if (!c.fullName.trim()) return "Add your full name.";
  if (!EMAIL_RE.test(c.email.trim())) return "Add a valid email address.";
  const phone = c.phone.trim();
  // At least 5 digits, so "------" or "( ) ( )" isn't taken for a number.
  if (phone && (!PHONE_RE.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 5))
    return "Check your phone number.";
  return "";
}

/** Trimmed copy for saving. */
export const cleanContact = (c: TalentContact): TalentContact => ({
  fullName: c.fullName.trim().replace(/\s+/g, " "),
  email: c.email.trim().toLowerCase(),
  phone: c.phone.trim(),
  city: c.city.trim(),
});
