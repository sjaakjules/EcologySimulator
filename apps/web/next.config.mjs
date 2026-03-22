/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  transpilePackages: [
    '@ecology/authoring',
    '@ecology/content-mountain-ash',
    '@ecology/domain',
    '@ecology/schema',
    '@ecology/scene3d',
    '@ecology/sim-core',
    '@ecology/storage',
    '@ecology/worker-runtime'
  ]
};

export default nextConfig;
