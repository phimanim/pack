import { Form } from "react-router";

export default function Home() {
  return (
    <main className="p-8">
      <h1>Pack</h1>
      <p>You are in.</p>
      <Form method="post" action="/logout">
        <button
          type="submit"
          className="mt-4 border border-neutral-300 px-3 py-1"
        >
          Log out
        </button>      </Form>
    </main>
  );
}
