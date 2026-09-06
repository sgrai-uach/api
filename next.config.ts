import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera un build standalone optimizado para despliegue en Docker.
  output: "standalone",
};

export default nextConfig;
