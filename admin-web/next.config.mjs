import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { loadEnvConfig } = nextEnv;

loadEnvConfig(__dirname);

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@kabisig/shared"]
};

export default nextConfig;
