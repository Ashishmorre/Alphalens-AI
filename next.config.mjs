/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    formats: ['image/webp'],
  },
}

export default nextConfig
