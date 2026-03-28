import createNextJsObfuscator from 'nextjs-obfuscator';

const withNextJsObfuscator = createNextJsObfuscator(
    {
        rotateStringArray: true,
        disableConsoleOutput: false,
    },
    {
        enabled: 'detect',
        patterns: [
            // Obfuscate all client-side code under app & components
            './app/**/*.(js|jsx|ts|tsx)',
            './components/**/*.(js|jsx|ts|tsx)',
        ],
        exclude: [
            // Exclude server-only / critical runtime pieces to keep production stable
            './app/**/*',
            './middleware.ts',
            './next.config.mjs',
            './tailwind.config.js',
            './postcss.config.mjs',
            './jsconfig.json',
            './tsconfig.json'
        ],
        log: true,
    }
);

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable static export for Netlify (uncomment if needed)
    // output: 'export',
    // trailingSlash: true,
    // images: {
    //     unoptimized: true,
    // },

    webpack: (config) => {
        config.externals.push({
            'node:crypto': 'commonjs crypto',
        });
        return config;
    },
};

export default withNextJsObfuscator(nextConfig);
