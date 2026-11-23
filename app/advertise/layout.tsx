import type { ReactNode } from 'react';
import '../styles/account.css';

// Scopes the account stylesheet (advertise, campaign studio, placement
// previews) to /advertise and its sub-routes.
export default function AdvertiseLayout({ children }: { children: ReactNode }) {
  return children;
}
