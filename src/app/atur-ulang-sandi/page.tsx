import type { Metadata } from "next";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default function Page() {
  return <ResetForm />;
}
