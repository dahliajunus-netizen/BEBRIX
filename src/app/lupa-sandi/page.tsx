import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function Page() {
  return <ForgotForm />;
}
