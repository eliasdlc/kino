import { CreateSystemDialog } from "./CreateSystemDialog";
import { SystemsList } from "./SystemsList";
import { PageWrapper, PageHeader } from "@/components/PageWrapper";

export default function SystemsPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Sistemas"
        description="Your identity-based productivity systems."
        actions={<CreateSystemDialog />}
      />

      <SystemsList />
    </PageWrapper>
  );
}
