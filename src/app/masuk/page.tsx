import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Masuk" };

export default function Page() {
  return <LoginForm />;
}
