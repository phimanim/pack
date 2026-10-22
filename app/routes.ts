import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("vocab", "routes/vocab.tsx"),
  route("roasters", "routes/roasters.tsx"),
  route("roasters/new", "routes/roasters.new.tsx"),
  route("roasters/:id", "routes/roasters.$id.tsx"),
  route("roasters/:id/edit", "routes/roasters.$id.edit.tsx"),
  route("cafes", "routes/cafes.tsx"),
  route("cafes/new", "routes/cafes.new.tsx"),
  route("cafes/:id", "routes/cafes.$id.tsx"),
  route("cafes/:id/edit", "routes/cafes.$id.edit.tsx"),
  route("cafes/:id/entries/new", "routes/cafes.$id.entries.new.tsx"),
  route("entries/new", "routes/entries.new.tsx"),
  route("entries/:id", "routes/entries.$id.tsx"),
  route("stats", "routes/stats.tsx"),
  route("coffees", "routes/coffees.tsx"),
  route("coffees/new", "routes/coffees.new.tsx"),
  route("coffees/:id", "routes/coffees.$id.tsx"),
  route("coffees/:id/edit", "routes/coffees.$id.edit.tsx"),
] satisfies RouteConfig;
