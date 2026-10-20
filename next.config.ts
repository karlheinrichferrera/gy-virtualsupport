import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/client-invoices/*/pdf": ["./src/assets/invoice-fonts/*"],
  },
};

export default nextConfig;
