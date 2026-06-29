declare global {
  // Next.js 16 generates this type via `next dev`, but we define it statically
  // so TypeScript is happy without running the dev server first.
  type RouteContext<_Path extends string = string> = {
    params: Promise<Record<string, string>>
  }
}

export {}
