const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function publicAssetPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicBasePath}${normalizedPath}`;
}