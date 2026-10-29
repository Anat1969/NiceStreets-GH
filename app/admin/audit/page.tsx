import { notFound } from "next/navigation";
import { isStaff } from "@/lib/session";
import { loadAuditOverview } from "@/lib/audit";
import AuditOverviewView from "@/components/AuditOverviewView";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  if (!(await isStaff())) notFound();
  return <AuditOverviewView overview={await loadAuditOverview()} />;
}
