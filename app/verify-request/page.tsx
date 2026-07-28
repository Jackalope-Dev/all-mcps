import { Mail } from "lucide-react";
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '0 2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ height: '64px', width: '64px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
            <Mail style={{ height: '32px', width: '32px', color: 'var(--accent-color)' }} />
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Check your email
        </h2>
        <p style={{ fontSize: '0.9rem', marginBottom: '2rem' }}>
          A sign in link has been sent to your email address. Click the link in the email to sign in.
        </p>
        
        <Link 
          href="/"
          className="nav-link"
          style={{ fontSize: '0.875rem' }}
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
