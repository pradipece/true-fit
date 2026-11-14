import occupations from "./esco/occupations.json";
import skills from "./esco/skills.json";
import companies from "./seed/companies.json";
import talent from "./seed/talent.json";
import { setEsco, type EscoSnapshot } from "@/lib/esco";
import { loadSeed, setSeed, type RawSeed } from "@/lib/seed";

/**
 * Synthetic test fixture: a snapshot of the database (`yarn db:dump` shape), so tests run
 * offline. The app itself never reads these files; it loads everything from the database.
 * Refresh with `yarn db:dump tests/fixtures` when the seed data changes.
 */
export const ESCO = { skills, occupations } as unknown as EscoSnapshot;
setEsco(ESCO);
export const SEED = loadSeed({ companies: companies.companies, talent: talent.talent } as unknown as RawSeed);
setSeed(SEED);
