import { signIn } from "@/lib/auth";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '0 2rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Image
            src="/logo-icon.svg"
            alt="AllMCPs Logo"
            width={48}
            height={48}
            style={{ margin: '0 auto 1rem', display: 'block' }}
          />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Sign in to AllMCPs</h2>
          <p style={{ fontSize: '0.9rem' }}>
            Enter your email to receive a secure login link. No password required.
          </p>
        </div>

        <form
          action={async (formData) => {
            "use server";
            await signIn("resend", formData);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}
        >
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="form-input"
            />
          </div>
          
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            Send Magic Link
          </button>
        </form>
      </div>
    </div>
  );
}
