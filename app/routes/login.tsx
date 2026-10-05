import { timingSafeEqual } from "node:crypto";
import { data, Form, redirect } from "react-router";
import { commitSession, getSession } from "~/sessions.server";
import type { Route } from "./+types/login";

function passwordMatches(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (session.get("userId")) {
    throw redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const expected = process.env.AUTH_PASSWORD ?? "";

  if (!expected || !passwordMatches(password, expected)) {
    return data({ error: "Wrong password" }, { status: 401 });
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", "owner");

  throw redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl">Pack</h1>
      {actionData?.error ? <p>{actionData.error}</p> : null}
      <Form method="post">
        <label>
          Password
          <input type="password" name="password" required autoFocus />
        </label>
        <button
          type="submit"
          className="mt-4 border border-neutral-300 px-3 py-1"
        >
          Log in
        </button>{" "}
      </Form>
    </main>
  );
}
