export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMonthlyGridData } from "@/actions/completions";
import { normalizeDate } from "@/lib/habits";
import { MonthlyGrid } from "@/components/monthly-grid";

interface MonthlyPageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function MonthlyPage({ searchParams }: MonthlyPageProps) {
  const params = await searchParams;

  const today = normalizeDate(new Date());
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;

  const year = params.year ? parseInt(params.year, 10) : currentYear;
  const month = params.month ? parseInt(params.month, 10) : currentMonth;

  if (
    isNaN(year) ||
    isNaN(month) ||
    month < 1 ||
    month > 12 ||
    year < 2020 ||
    year > 2100
  ) {
    redirect("/monthly");
  }

  const result = await getMonthlyGridData(year, month);

  if (!result.success) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <p className="text-destructive">Failed to load monthly data.</p>
      </div>
    );
  }

  const todayISO = today.toISOString();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Monthly Grid
          </h1>
          <nav className="flex items-center gap-3 text-sm">
            <a
              href={`/monthly?year=${prevYear}&month=${prevMonth}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Previous
            </a>
            <span className="font-semibold text-foreground">
              {new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
                "en-US",
                { month: "long", year: "numeric", timeZone: "UTC" },
              )}
            </span>
            <a
              href={`/monthly?year=${nextYear}&month=${nextMonth}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Next
            </a>
          </nav>
        </header>

        <MonthlyGrid data={result.data} todayISO={todayISO} />
      </div>
    </div>
  );
}
