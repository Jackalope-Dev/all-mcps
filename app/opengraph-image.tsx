import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'AllMCPs - The Directory for Model Context Protocol Servers';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          {/* Logo Mark */}
          <div
            style={{
              width: '60px',
              height: '60px',
              background: '#3b82f6',
              borderRadius: '12px',
              marginRight: '24px',
              display: 'flex',
            }}
          />
          <h2
            style={{
              fontSize: '48px',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            AllMCPs
          </h2>
        </div>
        
        <h1
          style={{
            fontSize: '72px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.1,
            marginBottom: '24px',
            letterSpacing: '-0.02em',
          }}
        >
          The Directory for Model Context Protocol Servers
        </h1>
        
        <p
          style={{
            fontSize: '32px',
            color: '#a3a3a3',
            lineHeight: 1.4,
            maxWidth: '900px',
          }}
        >
          Discover, filter, and install the best MCP servers to give your AI agents superpowers.
        </p>

        {/* Decorative Grid/Lines */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
