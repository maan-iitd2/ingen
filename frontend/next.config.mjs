/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mirrors the StrictMode wrapper the Vite entry used to apply.
  reactStrictMode: true,
  eslint: {
    // Keep build and lint separate, as they were under Vite (`vite build` never ran ESLint —
    // `npm run lint` is the dedicated gate). Avoids coupling the production build to pre-existing
    // lint debt in the source tree.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
