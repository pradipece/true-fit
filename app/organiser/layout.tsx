import { OrganiserAssistant } from "@/components/organiser-assistant";

/** Organiser pages share the Espoo Esbo assistant, so the chat stays open across them. */
export default function OrganiserLayout({ children }: LayoutProps<"/organiser">) {
  return (
    <>
      {children}
      <OrganiserAssistant />
    </>
  );
}
