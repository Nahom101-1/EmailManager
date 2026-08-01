import { redirect } from "next/navigation"

/** Alias for Today — canonical route remains /dashboard during migration. */
export default function TodayAliasPage() {
  redirect("/dashboard")
}
