import { Shell } from "@/components/shell";
import { LocalPreview } from "@/components/studio";
export const metadata = {
  title: "Editor local",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Shell active="/studio">
      <LocalPreview />
    </Shell>
  );
}
