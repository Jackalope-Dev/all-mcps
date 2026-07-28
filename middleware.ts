import { auth } from "@/lib/auth";

// This middleware automatically protects all routes that match the config matcher
export default auth;

export const config = {
  // Protect specific routes or use a matcher for standard protected areas
  // For example, protecting a /dashboard route:
  matcher: ["/dashboard/:path*"],
};
