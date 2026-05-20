import { ExpoRoot } from "./mobile-app/node_modules/expo-router";

export default function App() {
  const context = require.context("./mobile-app/app");
  return <ExpoRoot context={context} />;
}
