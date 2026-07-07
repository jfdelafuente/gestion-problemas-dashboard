import type { NextConfig } from "next";

// Vacío en local (se sirve en la raíz). En despliegues detrás de un nginx
// compartido que expone la app bajo un subpath (ej. /problemas), se fija
// vía NEXT_PUBLIC_BASE_PATH en el build de producción.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
