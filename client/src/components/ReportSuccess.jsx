import React, { useState } from 'react';
import { CheckCircle, Copy, Check, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';

export default function ReportSuccess({ result, onReset }) {
  const [copied, setCopied] = useState(false);

  const copyRef = () => {
    if (result && result.referenceId) {
      navigator.clipboard.writeText(result.referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleQuickExit = () => {
    window.location.replace('https://www.google.com/search?q=weather+today');
  };

  return (
    <div style={{
      maxWidth: '620px',
      margin: '2rem auto',
      background: 'white',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-lg)',
      padding: '2.5rem',
      textAlign: 'center'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        background: 'var(--accent-emerald-light)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 1.25rem'
      }}>
        <CheckCircle size={36} color="var(--accent-emerald)" />
      </div>

      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        Report Securely Submitted
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
        Thank you for helping keep the community informed. Your information has been securely received by our authorized safety dashboard team.
      </p>

      {/* Reference ID Card */}
      <div style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        marginBottom: '2rem'
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', fontWeight: 700 }}>
          Your Confidential Reference Code
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          fontSize: '1.35rem',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          color: 'var(--primary)'
        }}>
          <span>{result?.referenceId || 'SFR-2026-PENDING'}</span>
          <button
            type="button"
            onClick={copyRef}
            title="Copy reference code"
            style={{
              background: 'white',
              border: '1px solid var(--border)',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-secondary)'
            }}
          >
            {copied ? <Check size={16} color="var(--accent-emerald)" /> : <Copy size={16} />}
          </button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Keep this code if you ever need to follow up. It does not disclose your name or location.
        </div>
      </div>

      {/* What Happens Next Timeline */}
      <div style={{ textAlign: 'left', marginBottom: '2rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={18} color="var(--primary)" />
          What Happens Next:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>1. Cluster Analysis:</span>
            <span>Reports for this location are automatically counted over rolling 24-hour windows.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>2. Threshold Alerts:</span>
            <span>When 5+ reports emerge at a locality, verified community coordinators receive an alert to review patterns.</span>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>3. Coordinated Actions:</span>
            <span>Authorized staff can liaise with local transit supervisors, lighting authorities, or community escorts.</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={onReset}
          style={{
            background: 'var(--primary)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '0.95rem'
          }}
        >
          Submit Another Report
        </button>
        <button
          onClick={handleQuickExit}
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}
        >
          Quick Exit & Clear Screen
        </button>
      </div>
    </div>
  );
}
