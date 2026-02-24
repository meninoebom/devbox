import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("routes/layout.tsx", [
    route("workshops/http", "routes/workshops.http.tsx"),
    route("workshops/types", "routes/workshops.types.tsx"),
    route("workshops/forms", "routes/workshops.forms.tsx"),
    route("workshops/data", "routes/workshops.data.tsx"),
    route("workshops/auth", "routes/workshops.auth.tsx"),
    route("workshops/api-design", "routes/workshops.api-design.tsx"),
    route("workshops/responses", "routes/workshops.responses.tsx"),
    route("workshops/schema", "routes/workshops.schema.tsx"),
  ]),
] satisfies RouteConfig;
