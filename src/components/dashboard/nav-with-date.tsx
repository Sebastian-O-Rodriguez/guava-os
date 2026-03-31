"use client";

import { AppNav } from "@/components/app-nav";

type NavWithDateProps = {
  isoDate: string;
  dateString: string;
  isToday: boolean;
};

export function NavWithDate({ isoDate, dateString, isToday }: NavWithDateProps) {
  return <AppNav isoDate={isoDate} dateString={dateString} isToday={isToday} />;
}
