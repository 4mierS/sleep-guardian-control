import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ohne das greift Turbopack auf ein package-lock.json oberhalb des
  // Projekts zu und warnt bei jedem Build.
  turbopack: { root: __dirname },

  // Erzeugt .next/standalone mit eigenem server.js — dadurch braucht das
  // Docker-Image kein vollständiges node_modules.
  output: "standalone",
};

export default nextConfig;
