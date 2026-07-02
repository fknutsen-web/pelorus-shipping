import Link from "next/link";
import { login } from "@/app/actions/auth";
import { FlashMessages } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="container-page max-w-md py-16">
      <h1 className="text-2xl font-bold text-navy-900">Sign in</h1>
      <div className="mt-6">
        <FlashMessages error={error} />
        <form action={login} className="card space-y-4 p-6">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" className="input" required />
          </div>
          <button className="btn-primary w-full">Sign in</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Not a member yet?{" "}
          <Link href="/register" className="font-semibold text-navy-700 hover:underline">
            Apply for verification
          </Link>
        </p>
      </div>
    </div>
  );
}
