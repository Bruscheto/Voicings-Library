/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['music-engine', 'sampler', 'data-model', 'harmony', 'keyboard'],
};

module.exports = nextConfig;
