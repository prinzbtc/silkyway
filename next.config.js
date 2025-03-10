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
  // Configure static file serving for uploads
  async rewrites() {
    return [
      // Public uploads (accessible without authentication)
      {
        source: '/uploads/public/:path*',
        destination: '/public/uploads/public/:path*',
      },
      // Private uploads (require authentication and authorization)
      {
        source: '/uploads/medias/:path*',
        destination: '/api/serve/medias/:path*',
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
