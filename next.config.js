/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  modularizeImports: {
    'react-autosuggest': {
      transform: 'react-autosuggest/dist/standalone/{{member}}',
      skipDefaultConversion: true,
      preventFullImport: true
    }
  },
  images: {
    domains: ['images.unsplash.com'], // Allow Unsplash images
    unoptimized: process.env.NODE_ENV === 'development', // Don't optimize images in development
  },
  // Configure static file serving for public uploads
  async rewrites() {
    return [
      {
        source: '/uploads/:type/:path*',
        destination: '/public/uploads/:type/:path*',
      },
    ];
  },
  experimental: {
    serverActions: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}
