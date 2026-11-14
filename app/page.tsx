import { JobBoardHome } from "@/components/job-board-home";

/**
 * Public landing page, laid out as a job portal for job seekers. Companies and the Espoo
 * event team sign in from the side cards (lib/auth); every view below is role-protected.
 */
export default function HomePage() {
  return <JobBoardHome />;
}
