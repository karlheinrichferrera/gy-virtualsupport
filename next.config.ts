import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/client-invoices/*/pdf": ["./src/assets/invoice-fonts/*"],
    "/api/client-invoices/view/*": ["./src/assets/invoice-fonts/*"],
  },
};

export default nextConfig;
