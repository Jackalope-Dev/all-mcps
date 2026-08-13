'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SponsorAdUnit } from '../../../components/ads/SponsorAdUnit';
import {
  AD_PLACEMENTS,
  CPM_TIERS,
  calculateAdCostCents,
  formatUsdAmount,
  type AdPlacement,
} from '../../../lib/ads';
import { toast } from '../../../components/ui/Toast';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { trackFeatureUse } from '@/lib/gtag';
import {
  Sparkles,
  Layers,
  ArrowRight,
  Check,
  Eye,
  Sliders,
  DollarSign,
  Info,
  ExternalLink,
  ShieldCheck,
  UploadCloud,
  Loader2,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

export function AdvertiseStudioClient({
  initialTier,
  initialPlacement,
  initialVariant,
  canceled,
}: {
  initialTier?: string;
  initialPlacement?: string;
  initialVariant?: string;
  canceled?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [ctaText, setCtaText] = useState('');
  const [advertiserEmail, setAdvertiserEmail] = useState('');

  // Volume & Bidding State
  const [placement, setPlacement] = useState<AdPlacement>(
    (initialPlacement as AdPlacement) || 'all'
  );
  const [impressions, setImpressions] = useState<number>(10000);
  const [bidCpmCents, setBidCpmCents] = useState<number>(
    initialTier === 'blitz' ? 2000 : initialTier === 'growth' ? 1000 : 500
  );

  // Live Preview Formats
  const [activePreviewFormat, setActivePreviewFormat] = useState<AdPlacement>(
    placement === 'all' ? 'directory_inline' : placement
  );

  const [submitting, setSubmitting] = useState(false);

  // Computed Pricing
  const totalCostCents = calculateAdCostCents(impressions, bidCpmCents);
  const weightFactor = (bidCpmCents / 500).toFixed(1);

  // Preview Object
  const previewAdData = {
    title: title.trim() || 'Your Product Title',
    description:
      description.trim() ||
      'Describe what makes your developer tool or application awesome. Instant high-intent discovery.',
    targetUrl: targetUrl.trim() || 'https://yourwebsite.com',
    logoUrl: logoUrl.trim() || undefined,
    ctaText: ctaText.trim() || 'Learn More',
    placement,
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5MB or smaller.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid PNG, JPEG, or WebP image.');
      return;
    }

    setLogoFileName(file.name);
    setUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ads/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as { success?: boolean; logoUrl?: string; error?: string };
      if (!res.ok || !data.success || !data.logoUrl) {
        throw new Error(data.error || 'Failed to upload logo.');
      }

      setLogoUrl(data.logoUrl);
      toast.success('Logo uploaded and optimized for CDN.');
    } catch (err: any) {
      toast.error(err?.message || 'Logo upload failed. Please try another image.');
      setLogoUrl('');
      setLogoFileName('');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoUrl) {
      toast.error('Please upload a logo or app icon before submitting.');
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch('/api/ads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          targetUrl,
          logoUrl,
          ctaText: ctaText || 'Learn More',
          advertiserEmail,
          placement,
          impressions,
          bidCpm: bidCpmCents,
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        checkoutUrl?: string;
        redirectUrl?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      trackFeatureUse('sponsor_campaign_submitted', {
        placement,
        impressions,
        bidCpm: bidCpmCents,
        variant: initialVariant || 'direct',
      });

      toast.success('Campaign created successfully!');
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.redirectUrl) {
        router.push(data.redirectUrl);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Submission failed. Please check inputs.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2.5rem', alignItems: 'start' }}>
      {/* LEFT COLUMN: CREATION CONTROLS */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {canceled && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            Checkout was canceled. You can adjust your campaign below and try again.
          </div>
        )}

        {/* Step 1: Ad Creative Details */}
        <div className="surface" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--brand-gradient)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              1
            </span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Ad Creative</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <Input
              label="Tool / Company Headline *"
              type="text"
              maxLength={50}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Acme Vector DB"
              required
              helperText={`${title.length}/50 characters`}
            />

            <Textarea
              label="Description / Body Copy *"
              rows={2}
              maxLength={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short punchy value proposition for AI engineers..."
              required
              helperText={`${description.length}/140 characters`}
              style={{ resize: 'none' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Input
                label="CTA Button Text"
                type="text"
                maxLength={25}
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="e.g. Try Free"
              />
              <Input
                label="Target Destination URL *"
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                required
              />
            </div>

            {/* Logo Image Upload */}
            <div className="form-field">
              <label className="form-label">
                Logo / App Icon *
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              {!logoUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                  className="hover:border-accent"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Optimizing &amp; uploading to CDN...
                      </span>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(0, 229, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-color)',
                        }}
                      >
                        <UploadCloud size={20} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Click to upload logo or drag &amp; drop
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        PNG or JPEG up to 5MB (Square 1:1 recommended)
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <img
                      src={logoUrl}
                      alt="Uploaded Logo Preview"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        objectFit: 'contain',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid var(--border-color)',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {logoFileName || 'Custom Logo'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#10b981' }}>
                        <Check size={12} /> Stored on CDN
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUrl('');
                        setLogoFileName('');
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.5rem', color: '#f87171' }}
                      title="Remove Logo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Placement & Bidding */}
        <div className="surface" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--brand-gradient)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              2
            </span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Volume &amp; Bidding</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            {/* Placement Selection */}
            <Select
              label="Target Placement"
              value={placement}
              onChange={(e) => {
                const p = e.target.value as AdPlacement;
                setPlacement(p);
                if (p !== 'all') setActivePreviewFormat(p);
              }}
            >
              {Object.values(AD_PLACEMENTS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.tagline}
                </option>
              ))}
            </Select>

            {/* Impression Blocks */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Impression Block Volume
                </label>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                  {impressions.toLocaleString()} views
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {[1000, 5000, 10000, 25000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setImpressions(val)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: impressions === val ? 'var(--brand-gradient)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: impressions === val ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
              </div>

              <input
                type="range"
                min={1000}
                max={100000}
                step={1000}
                value={impressions}
                onChange={(e) => setImpressions(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
              />
            </div>

            {/* CPM Bidding */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  CPM Bid (Delivery Speed &amp; Priority)
                </label>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                  {formatUsdAmount(bidCpmCents)} / 1k ({weightFactor}x weight)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {CPM_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setBidCpmCents(tier.cpmCents)}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      background: bidCpmCents === tier.cpmCents ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.03)',
                      border: bidCpmCents === tier.cpmCents ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                      color: bidCpmCents === tier.cpmCents ? 'var(--accent-color)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>{tier.label}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ${(tier.cpmCents / 100).toFixed(0)}
                    </div>
                  </button>
                ))}
              </div>

              <input
                type="range"
                min={200}
                max={5000}
                step={100}
                value={bidCpmCents}
                onChange={(e) => setBidCpmCents(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <span>$2 Base (Economy)</span>
                <span>$20 Rush (High Traffic)</span>
                <span>$50 Blitz</span>
              </div>
            </div>

            {/* Advertiser Email */}
            <Input
              label="Your Email Address (for tracking dashboard & updates) *"
              type="email"
              value={advertiserEmail}
              onChange={(e) => setAdvertiserEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
        </div>

        {/* Step 3: Checkout Summary */}
        <div
          className="surface"
          style={{
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid var(--accent-color)',
            background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.05), rgba(0, 123, 255, 0.05))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-color)' }}>
                Campaign Total
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatUsdAmount(totalCostCents)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Guaranteed Delivery</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                {impressions.toLocaleString()} views
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
            ✓ 100% guaranteed delivery of {impressions.toLocaleString()} views
            <br />
            ✓ Real-time advertiser tracking dashboard with CTR &amp; click metrics
            <br />
            ✓ Campaign review &amp; activation within 12–24 hours
            <br />
            ✓ 100% full refund guarantee if rejected for any reason
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem', gap: '8px' }}
          >
            {submitting ? 'Preparing Campaign...' : `Launch Campaign · ${formatUsdAmount(totalCostCents)}`} <ArrowRight size={16} />
          </button>
        </div>
      </form>

      {/* RIGHT COLUMN: LIVE MULTI-FORMAT PREVIEW */}
      <div style={{ position: 'sticky', top: '2rem' }}>
        <div className="surface" style={{ borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Eye size={16} style={{ color: 'var(--accent-color)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Live Multi-Format Preview</h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Instant rendering</span>
          </div>

          {/* Format Switcher Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
            {(['directory_inline', 'detail_sidebar', 'header_banner', 'blog_guide'] as AdPlacement[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setActivePreviewFormat(fmt)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: activePreviewFormat === fmt ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                  border: activePreviewFormat === fmt ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  color: activePreviewFormat === fmt ? 'var(--accent-color)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {fmt === 'directory_inline'
                  ? 'Directory Card'
                  : fmt === 'detail_sidebar'
                  ? 'Sidebar Box'
                  : fmt === 'header_banner'
                  ? 'Category Banner'
                  : 'Article Banner'}
              </button>
            ))}
          </div>

          {/* Active Preview Render */}
          <div style={{ minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <SponsorAdUnit placement={activePreviewFormat} previewAd={previewAdData} />
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
              <span>
                All ads clearly display a <strong>Sponsored</strong> label to maintain community trust and high engagement.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
