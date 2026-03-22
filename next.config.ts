import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
// GitHub Pages for project repositories are served under a subdirectory (/repo-name/)
// We need to set basePath and assetPrefix for all assets and links to work correctly.
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "Mini-Car-game";
const basePath = (isGithubActions || process.env.NODE_ENV === "production") ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  ...(basePath
    ? {
        basePath,
        assetPrefix: `${basePath}/`,
      }
    : {}),
};

export default nextConfig;
