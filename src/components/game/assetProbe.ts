export async function assetExists(path: string): Promise<boolean> {
  try {
    const head = await fetch(path, { method: "HEAD" });
    if (head.ok) {
      return true;
    }
  } catch {
    // Fall through to GET probe.
  }

  try {
    const get = await fetch(path, { method: "GET", cache: "no-store" });
    return get.ok;
  } catch {
    return false;
  }
}