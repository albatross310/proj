import { index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.jsx"),
  route("about", "routes/about.jsx"),
  route("how-to-play", "routes/how-to-play.jsx"),
  route("reset-password", "routes/reset-password.jsx")
];
