import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
import { isValidDate, japanDate } from "@/lib/calendar";
import { loadCalendar } from "@/lib/data";
import { Setup } from "@/components/ui/setup";
import { DataError } from "@/components/ui/retry";
import { FamilyCalendar } from "@/components/family/family-calendar";

export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  if (!supabaseConfig()) return <Setup />;
  const { view, date } = await searchParams;
  const today = japanDate();
  const selectedDate = date && isValidDate(date) ? date : today;
  const selectedView = view === "calendar" || view === "settings" ? view : "home";
  const data = await loadCalendar(selectedDate, today);
  if ("error" in data) return <DataError message={data.error} />;
  if ("unauthenticated" in data) redirect("/login");
  return <FamilyCalendar {...data} today={today} selectedDate={selectedDate} view={selectedView} now={new Date().toISOString()} />;
}
