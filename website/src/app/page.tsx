import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  // The root page shares the layout's segment, so title.template does not
  // apply here; set the full title explicitly.
  title: "Login - ALUG@UCI Community Services",
};

export default function Home() {
  return <LoginForm />;
}
