import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { Page } from "@/components/ui/Page";

export const metadata: Metadata = {
  title: "404",
};

export default function NotFound() {
  return (
    <Page title="404 — Not found">
      <Card className="flex flex-col gap-3">
        <p>The page you are looking for does not exist.</p>
        <Link href="/">Go back home</Link>
      </Card>
    </Page>
  );
}
