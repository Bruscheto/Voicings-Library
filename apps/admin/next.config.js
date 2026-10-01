/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['music-engine', 'sampler', 'data-model', 'harmony'],
};

module.exports = nextConfig;
