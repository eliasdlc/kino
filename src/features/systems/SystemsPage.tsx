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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search systems..." />
      </div>
      <SystemsList />
    </PageWrapper>
  );
}
