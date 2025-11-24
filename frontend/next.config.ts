import type { NextConfig } from "next";

// Get basePath from environment variable (set by GitHub Actions)
// If REPO_NAME is in format "username.github.io", basePath is empty
// Otherwise, basePath is "/<repo-name>"
const getBasePath = (): string => {
  const repoName = process.env.REPO_NAME || "";
  const githubUsername = process.env.GITHUB_USERNAME || "";
  
  // Check if repository name matches username.github.io pattern
  if (repoName && githubUsername && repoName === `${githubUsername}.github.io`) {
    return "";
  }
  
  // If REPO_BASEPATH is explicitly set, use it
  if (process.env.REPO_BASEPATH) {
    return process.env.REPO_BASEPATH;
  }
  
  // Otherwise, use repo name as basePath
  if (repoName) {
    return `/${repoName}`;
  }
  
  // Default: no basePath (for local development)
  return "";
};

const basePath = getBasePath();

const nextConfig: NextConfig = {
  // Enable static export for GitHub Pages
  output: process.env.NEXT_EXPORT === "true" ? "export" : undefined,
  
  // Set basePath for GitHub Pages deployment
  // Only set if basePath is not empty (empty means root domain deployment)
  ...(basePath && { basePath, assetPrefix: basePath }),
  
  // Optimize images handling for static export and GitHub Pages
  images: { unoptimized: true },
  // Ensure trailing slash for static hosting compatibility
  trailingSlash: true,
  
  // Headers configuration (only works for non-static exports)
  // Note: GitHub Pages doesn't support custom headers, but keeping this
  // for other deployment scenarios
  ...(process.env.NEXT_EXPORT !== "true" && {
    headers() {
      // Required by FHEVM 
      return Promise.resolve([
        {
          source: '/:path*',
          headers: [
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
          ],
        },
        {
          source: '/:path*.wasm',
          headers: [
            {
              key: 'Content-Type',
              value: 'application/wasm',
            },
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
          ],
        },
      ]);
    }
  })
};

export default nextConfig;

