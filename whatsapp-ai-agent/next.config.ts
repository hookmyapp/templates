import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its own WebAssembly assets at runtime.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
