import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
// GitHub Pages for project repositories are served under a subdirectory (/repo-name/)
const repoName = "Mini-Car-game";
const basePath = (isGithubActions || process.env.NODE_ENV === "production") ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  // Disabling experimental compiler to ensure standard CSS extraction
  reactCompiler: false,
  output: "export",
  // Ensure trailing slashes are handled correctly for GitHub Pages subdirectories
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : "",
};

export default nextConfig;
