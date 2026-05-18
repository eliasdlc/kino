import { CreateSystemDialog } from "./CreateSystemDialog";
import { SystemsList } from "./SystemsList";
import { PageWrapper, PageHeader } from "@/components/PageWrapper";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function SystemsPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Systems"
        description="Your identity-based productivity systems."
        actions={<CreateSystemDialog />}
      />

      <SystemsList />
    </PageWrapper>
  );
}
