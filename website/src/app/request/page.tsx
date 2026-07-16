import type { Metadata } from "next";
import RequestForm from "./RequestForm";

export const metadata: Metadata = {
  title: "Request",
};

export default function RequestPage() {
  return <RequestForm />;
}
