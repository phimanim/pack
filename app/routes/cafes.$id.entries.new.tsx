import { redirect } from "react-router";

export async function loader({ params }: { params: { id: string } }) {
  throw redirect(`/entries/new?cafeId=${params.id}`);
}

export default function RedirectCafeEntry() {
  return null;
}
