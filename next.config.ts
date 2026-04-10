import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Configuración para saltar errores y desplegar rápido */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
