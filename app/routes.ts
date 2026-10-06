import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("vocab", "routes/vocab.tsx"),
  route("roasters", "routes/roasters.tsx"),
  route("roasters/new", "routes/roasters.new.tsx"),
  route("roasters/:id", "routes/roasters.$id.tsx"),
  route("coffees", "routes/coffees.tsx"),
  route("coffees/new", "routes/coffees.new.tsx"),
  route("coffees/:id", "routes/coffees.$id.tsx"),
] satisfies RouteConfig;
