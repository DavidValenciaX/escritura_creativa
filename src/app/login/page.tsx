import { Shell } from "@/components/shell";
import { configured } from "@/lib/supabase/server";
import { Setup } from "@/components/setup";
import { Login } from "@/components/login";
export default function Page() {
  return <Shell>{configured() ? <Login /> : <Setup />}</Shell>;
}
