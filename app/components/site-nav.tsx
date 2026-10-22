import { Link } from "react-router";

export function SiteNav() {
  return (
    <p className="text-sm">
      <Link to="/coffees" className="underline">
        Library
      </Link>
      {" · "}
      <Link to="/coffees/new" className="underline">
        Add a coffee
      </Link>
      {" · "}
      <Link to="/roasters" className="underline">
        Roasters
      </Link>
      {" · "}
      <Link to="/cafes" className="underline">
        Cafés
      </Link>
      {" · "}
      <Link to="/vocab" className="underline">
        Vocabularies
      </Link>
      {" · "}
      <Link to="/stats" className="underline">
        Stats
      </Link>
    </p>
  );
}
