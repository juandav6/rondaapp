export async function getParams<T>(p: T | Promise<T>): Promise<T> {
  return typeof (p as any)?.then === "function" ? await (p as Promise<T>) : (p as T);
}
