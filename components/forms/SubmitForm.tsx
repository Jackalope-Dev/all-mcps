'use client';

import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TurnstileWidget } from '../ui/TurnstileWidget';

export function SubmitForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      alert("Please complete the Turnstile challenge.");
      return;
    }
    
    setStatus('loading');
    setErrorMsg('');
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    data['cf-turnstile-response'] = token;

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (res.ok) {
        setStatus('success');
      } else {
        const errorData = await res.json().catch(() => null) as { error?: unknown } | null;
        const serverError = errorData?.error ? (typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error)) : 'Submission failed.';
        setErrorMsg(serverError);
        setStatus('error');
        (window as any).turnstile?.reset();
        setToken('');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
      setStatus('error');
      (window as any).turnstile?.reset();
      setToken('');
    }
  };

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h3>Server submitted successfully!</h3>
        <p>It is now pending review.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Input name="name" label="Server Name" placeholder="e.g., GitHub MCP" />
      <Input name="url" label="Repository URL" placeholder="https://github.com/..." required />
      <Input name="description" label="Short Description" placeholder="A brief description of what this server does" />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Category</label>
        <select name="category" className="form-input">
          <option>Developer Tools</option>
          <option>Database</option>
          <option>File System</option>
          <option>Web Search</option>
          <option>Community</option>
          <option>Other</option>
        </select>
      </div>

      <TurnstileWidget onSuccess={setToken} onExpire={() => setToken('')} onError={() => setToken('')} />

      <Button variant="primary" type="submit" disabled={status === 'loading'} style={{ marginTop: '1rem', alignSelf: 'flex-start' }}>
        {status === 'loading' ? 'Submitting...' : 'Submit Server'}
      </Button>
      {status === 'error' && <p style={{ color: 'red', marginTop: '0.5rem' }}>{errorMsg}</p>}
    </form>
  );
}
