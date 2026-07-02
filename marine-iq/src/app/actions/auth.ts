"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  company_name: z.string().min(2, "Company is required"),
  job_title: z.string().min(2, "Job title is required"),
  email: z.string().email("A valid corporate email is required"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  linkedin_url: z
    .string()
    .url("A valid LinkedIn URL is required")
    .refine((u) => u.includes("linkedin.com"), "Must be a linkedin.com profile URL"),
  country: z.string().min(2, "Country is required"),
  sector_id: z.string().min(1, "Maritime sector is required"),
});

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "live.com",
]);

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function register(formData: FormData) {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    fail("/register", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const input = parsed.data;

  const domain = input.email.split("@")[1]?.toLowerCase() ?? "";
  const corporateEmail = !FREE_EMAIL_DOMAINS.has(domain);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
      data: {
        full_name: input.full_name,
        company_name: input.company_name,
        job_title: input.job_title,
        linkedin_url: input.linkedin_url,
        country: input.country,
        sector_id: input.sector_id,
        corporate_email_domain: corporateEmail,
      },
    },
  });

  if (error) fail("/register", error.message);

  // Optional verification uploads (business card / conference badge). Only
  // possible immediately when email confirmation is disabled and a session
  // exists; otherwise the dashboard offers the same upload after sign-in.
  if (data.session) {
    for (const [field, docType] of [
      ["business_card", "business_card"],
      ["conference_badge", "conference_badge"],
    ] as const) {
      const file = formData.get(field) as File | null;
      if (file && file.size > 0) {
        const path = `${data.session.user.id}/${docType}-${crypto.randomUUID()}`;
        const { error: uploadError } = await supabase.storage
          .from("verification-docs")
          .upload(path, file, { contentType: file.type });
        if (!uploadError) {
          await supabase.from("verification_documents").insert({
            user_id: data.session.user.id,
            doc_type: docType,
            storage_path: path,
          });
        }
      }
    }
  }

  redirect("/verification-pending");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/login", error.message);

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Upload a verification document from the dashboard (post-signup). */
export async function uploadVerificationDoc(formData: FormData) {
  const session = await getSession();
  if (!session.userId) fail("/login", "Sign in first");

  const docType = String(formData.get("doc_type") ?? "other");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) fail("/dashboard", "Choose a file to upload");
  if (file.size > 8 * 1024 * 1024) fail("/dashboard", "File must be under 8 MB");

  const supabase = await createClient();
  const path = `${session.userId}/${docType}-${crypto.randomUUID()}`;
  const { error } = await supabase.storage
    .from("verification-docs")
    .upload(path, file, { contentType: file.type });
  if (error) fail("/dashboard", error.message);

  await supabase.from("verification_documents").insert({
    user_id: session.userId,
    doc_type: docType,
    storage_path: path,
  });

  redirect("/dashboard?uploaded=1");
}
