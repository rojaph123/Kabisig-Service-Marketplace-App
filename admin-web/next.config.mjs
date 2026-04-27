import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvConfig } = nextEnv;

loadEnvConfig(__dirname);

const nextConfig = {
  transpilePackages: ["@kabisig/shared"]
};

export default nextConfig;
