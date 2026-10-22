import { Coffee } from "lucide-react";
import { Link, useLocation } from "react-router";
import { Button } from "~/components/ui/button";

export function SiteNav() {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
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
      {pathname === "/entries/new" ? null : (
        <Button render={<Link to="/entries/new" />} data-testid="nav-log-cup">
          <Coffee data-icon="inline-start" />
          Log a cup
        </Button>
      )}
    </div>
  );
}
