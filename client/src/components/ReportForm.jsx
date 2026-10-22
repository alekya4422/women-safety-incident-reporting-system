import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  UploadCloud,
  X,
  Shield,
  Lock,
  Info,
  CheckCircle2,
  Compass,
  UserCheck
} from 'lucide-react';
import { submitIncidentReport, fetchSuggestions } from '../services/api';

const CATEGORIES = [
  { id: 'harassment', label: 'Harassment', desc: 'Verbal catcalling, stalking remarks, intimidation' },
  { id: 'stalking', label: 'Stalking / Following', desc: 'Being shadowed or tracked persistently' },
  { id: 'unsafe_transport', label: 'Unsafe Transport', desc: 'Harassing cab/auto drivers, dark transit stops' },
  { id: 'assault', label: 'Physical Assault / Threat', desc: 'Physical altercation or imminent threat' },
  { id: 'suspicious_behavior', label: 'Suspicious Behavior', desc: 'Individuals lingering in shadows or voyeurism' },
  { id: 'other', label: 'Other Safety Concern', desc: 'Broken infrastructure, hazard, or other issues' }
];

export default function ReportForm({ onSuccess }) {
  // Form fields
  const [placeOriginal, setPlaceOriginal] = useState('');
  const [placeLandmark, setPlaceLandmark] = useState('');
  const [coordinatesApprox, setCoordinatesApprox] = useState('');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incidentTime, setIncidentTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [timeApprox, setTimeApprox] = useState(false);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [reporterContactNote, setReporterContactNote] = useState('');
  
  // Image handling
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  
  // State
  const [suggestions, setSuggestions] = useState([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load suggested recognizable places
  useEffect(() => {
    fetchSuggestions()
      .then(res => {
        if (res.suggestions) setSuggestions(res.suggestions);
      })
      .catch(() => {});
  }, []);

  // Handle image selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Validate size (max 5MB per file) and count (max 3)
    const valid = [];
    const previews = [];

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`File ${f.name} exceeds the 5MB size limit.`);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setError('Only JPEG, PNG, or WebP images are supported.');
        return;
      }
      valid.push(f);
      previews.push(URL.createObjectURL(f));
    }

    setSelectedFiles(prev => [...prev, ...valid].slice(0, 3));
    setPreviewUrls(prev => [...prev, ...previews].slice(0, 3));
    setError('');
  };

  const removeImage = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Optional Geolocation with clear consent
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const approx = `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`;
        setCoordinatesApprox(approx);
        setShowConsentModal(false);
      },
      (err) => {
        setLocating(false);
        setError('Unable to retrieve location. Please type the place name manually.');
        setShowConsentModal(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!placeOriginal.trim()) {
      setError('Please provide a recognizable place name or locality.');
      return;
    }

    if (!category) {
      setError('Please select an incident category.');
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setError('Please provide at least a short description (minimum 5 characters).');
      return;
    }

    setLoading(true);

    try {
      const combinedDateTime = new Date(`${incidentDate}T${incidentTime}:00`).toISOString();

      const formData = new FormData();
      formData.append('place_original', placeOriginal.trim());
      if (placeLandmark.trim()) formData.append('place_landmark', placeLandmark.trim());
      if (coordinatesApprox) formData.append('coordinates_approx', coordinatesApprox);
      formData.append('incident_time', combinedDateTime);
      formData.append('incident_time_approx', timeApprox ? 'true' : 'false');
      formData.append('category', category);
      formData.append('description', description.trim());
      if (reporterContact.trim()) formData.append('reporter_contact', reporterContact.trim());
      if (reporterContactNote.trim()) formData.append('reporter_contact_note', reporterContactNote.trim());

      selectedFiles.forEach(file => {
        formData.append('images', file);
      });

      const response = await submitIncidentReport(formData);
      onSuccess(response);
    } catch (err) {
      setError(err.message || 'Submission failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Intro Header */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Report a Safety Concern or Incident
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto' }}>
          Your submission is confidential. Reports help safety administrators spot danger clusters and coordinate community patrols. No account required.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecdd3',
          color: '#991b1b',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem'
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        padding: '1.75rem'
      }}>
        {/* Section 1: Place */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            1. Where did it happen? <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
            Enter a recognized neighborhood, metro station, bus stop, or landmark (e.g. "KPHB Metro").
          </p>

          <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
            <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              required
              value={placeOriginal}
              onChange={(e) => setPlaceOriginal(e.target.value)}
              placeholder="e.g. KPHB Metro, Hitec City, Jubilee Hills..."
              style={{
                width: '100%',
                padding: '0.7rem 0.75rem 0.7rem 2.4rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.95rem'
              }}
            />
          </div>

          {/* Quick Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Suggested:</span>
              {suggestions.slice(0, 5).map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setPlaceOriginal(s)}
                  style={{
                    background: 'var(--bg-subtle)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)'
                  }}
                >
                  + {s}
                </button>
              ))}
            </div>
          )}

          {/* Landmark / Address */}
          <input
            type="text"
            value={placeLandmark}
            onChange={(e) => setPlaceLandmark(e.target.value)}
            placeholder="Specific landmark / gate / crossroad (optional, e.g. Gate B stairs, Pillar 742)"
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)'
            }}
          />

          {/* Optional Approximate Location with explicit consent */}
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            {coordinatesApprox ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={14} /> Approximate location attached ({coordinatesApprox})
                <button type="button" onClick={() => setCoordinatesApprox('')} style={{ color: '#dc2626', textDecoration: 'underline', marginLeft: '0.4rem' }}>Remove</button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowConsentModal(true)}
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 600
                }}
              >
                <Compass size={14} />
                Add approximate device location (Optional)
              </button>
            )}
          </div>
        </div>

        {/* Section 2: When */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            2. When did it take place? <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Date</span>
              <input
                type="date"
                required
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Local Time</span>
              <input
                type="time"
                required
                value={incidentTime}
                onChange={(e) => setIncidentTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={timeApprox}
              onChange={(e) => setTimeApprox(e.target.checked)}
            />
            Time is approximate or not precisely known
          </label>
        </div>

        {/* Section 3: Incident Type */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            3. What type of safety issue occurred? <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            {CATEGORIES.map(cat => {
              const selected = category === cat.id;
              return (
                <div
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                    background: selected ? 'var(--primary-light)' : 'white',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: selected ? 'var(--primary)' : 'var(--text-primary)', marginBottom: '0.15rem' }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {cat.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Description Textarea */}
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
            Describe what happened: <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what occurred, any vehicle details, clothing or characteristics, or environmental factors (e.g. dark alley, non-functional streetlight). Share only what you feel safe sharing."
            maxLength={3000}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {description.length} / 3000 characters
          </div>
        </div>

        {/* Section 4: Optional Photo Upload */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem', color: 'var(--text-primary)' }}>
            4. Optional Photo / Location Evidence (Max 3, up to 5MB each)
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
            Never put yourself at risk to take pictures. EXIF & GPS location metadata are stripped automatically upon upload for your privacy.
          </p>

          <label style={{
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            background: 'var(--bg-subtle)',
            cursor: 'pointer'
          }}>
            <UploadCloud size={28} color="var(--primary)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary)' }}>Click to browse or drop photo</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supported: JPEG, PNG, WebP (Private storage)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>

          {previewUrls.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {previewUrls.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img src={url} alt={`Evidence preview ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 5: Optional Follow-up Contact */}
        <div style={{
          marginBottom: '1.75rem',
          background: 'var(--bg-subtle)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <UserCheck size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Optional Contact Details for Follow-up
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
            Only provide if you wish for verified community safety staff to reach out. This is stored with strict access controls, isolated from the public, and only opened with an administrative audit trail.
          </p>

          <input
            type="text"
            value={reporterContact}
            onChange={(e) => setReporterContact(e.target.value)}
            placeholder="Optional Phone Number or Email (leave blank to remain 100% anonymous)"
            style={{
              width: '100%',
              padding: '0.65rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem',
              background: 'white',
              marginBottom: '0.5rem'
            }}
          />
          {reporterContact.trim() && (
            <input
              type="text"
              value={reporterContactNote}
              onChange={(e) => setReporterContactNote(e.target.value)}
              placeholder="Preferred contact method (e.g. WhatsApp text only between 2-4 PM)"
              style={{
                width: '100%',
                padding: '0.6rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                background: 'white'
              }}
            />
          )}
        </div>

        {/* Safety & Privacy Notice */}
        <div style={{
          background: '#f8fafc',
          borderLeft: '4px solid var(--primary)',
          padding: '0.75rem 1rem',
          marginBottom: '1.75rem',
          borderRadius: '0 8px 8px 0',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Shield size={16} color="var(--primary)" />
            SafeSignal Privacy & Operational Commitment:
          </div>
          <div>• Reports are aggregated by locality (e.g. 5 reports in 24h triggers a patrol alert).</div>
          <div>• Uploaded images are stored privately and never published on open web feeds.</div>
          <div>• Submitting this form does NOT automatically contact police or dispatch emergency services.</div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#94a3b8' : 'var(--primary)',
            color: 'white',
            padding: '0.9rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: 'var(--shadow-md)',
            transition: 'background 0.2s ease'
          }}
        >
          {loading ? 'Submitting Secure Report...' : 'Submit Confidential Report'}
        </button>
      </form>

      {/* Geolocation Consent Modal */}
      {showConsentModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ padding: '1.5rem', maxWidth: '450px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Compass size={22} color="var(--primary)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Location Consent</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              SafeSignal does not require precise GPS coordinates. If you consent, your device will share an approximate coordinate to help safety responders visualize general neighborhood safety patterns.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                style={{
                  padding: '0.55rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: '1px solid var(--border)'
                }}
              >
                Cancel / Manual Entry
              </button>
              <button
                type="button"
                onClick={requestGeolocation}
                disabled={locating}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: 'var(--primary)',
                  color: 'white'
                }}
              >
                {locating ? 'Retrieving...' : 'I Consent, Use Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
