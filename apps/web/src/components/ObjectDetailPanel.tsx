/**
 * Object Detail Panel Component
 * Shows details about clicked celestial objects and allows saving observations/favorites
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { saveObservation, addToFavorites, isFavorited, uploadObservationPhoto } from '../services/supabase-service';
import {
  Moon,
  Sun1,
  Global,
  Star1,
  Calendar,
  Location,
  Camera,
  CloseCircle,
  TickCircle,
  Star,
  Lock,
  Trash,
  Magicpen,
} from 'iconsax-react';

// Categories matching the database constraint
const OBSERVATION_CATEGORIES = [
  { id: 'Moon', label: 'Moon', Icon: Moon, points: 5 },
  { id: 'Planet', label: 'Planet', Icon: Global, points: 10 },
  { id: 'Nebula', label: 'Nebula', Icon: Magicpen, points: 20 },
  { id: 'Galaxy', label: 'Galaxy', Icon: Global, points: 25 },
  { id: 'Cluster', label: 'Cluster', Icon: Star, points: 15 },
  { id: 'Constellation', label: 'Constellation', Icon: Star1, points: 8 },
] as const;

type ObservationCategory = typeof OBSERVATION_CATEGORIES[number]['id'];

interface ObjectDetailPanelProps {
  object: {
    type: 'star' | 'planet' | 'messier' | 'constellation' | 'moon' | 'sun' | 'deepsky';
    id: string;
    name: string;
    ra?: number;
    dec?: number;
    magnitude?: number;
    spectralType?: string;
    illumination?: number;
    phaseName?: string;
    objectType?: string;
    status?: string;
  };
  location: { latitude: number; longitude: number };
  onClose: () => void;
}

// Map object types to default categories
function getDefaultCategory(objectType: string, deepSkyType?: string): ObservationCategory {
  switch (objectType) {
    case 'moon':
      return 'Moon';
    case 'planet':
    case 'sun':
      return 'Planet';
    case 'constellation':
      return 'Constellation';
    case 'deepsky':
    case 'messier':
      if (deepSkyType) {
        if (deepSkyType.toLowerCase().includes('galaxy')) return 'Galaxy';
        if (deepSkyType.toLowerCase().includes('nebula')) return 'Nebula';
        if (deepSkyType.toLowerCase().includes('cluster')) return 'Cluster';
      }
      return 'Nebula';
    case 'star':
    default:
      return 'Constellation';
  }
}

// Get header icon based on object type
function getHeaderIcon(type: string) {
  switch (type) {
    case 'moon':
      return <Moon size={40} color="#e8e8e0" variant="Bulk" />;
    case 'sun':
      return <Sun1 size={40} color="#ffcc00" variant="Bulk" />;
    case 'planet':
      return <Global size={40} color="#ffdd44" variant="Bulk" />;
    case 'deepsky':
    case 'messier':
      return <Magicpen size={40} color="#a855f7" variant="Bulk" />;
    case 'constellation':
      return <Star1 size={40} color="#6699ff" variant="Bulk" />;
    default:
      return <Star size={40} color="#ffffff" variant="Bulk" />;
  }
}

export default function ObjectDetailPanel({ object, location, onClose }: ObjectDetailPanelProps) {
  const [user, setUser] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ObservationCategory>(
    getDefaultCategory(object.type, object.objectType)
  );
  const [observationDate, setObservationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [locationName, setLocationName] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        isFavorited(object.type, object.id).then(setFavorited);
      }
    });
  }, [object.type, object.id]);

  const selectedCategoryData = OBSERVATION_CATEGORIES.find(c => c.id === selectedCategory);
  const pointsToEarn = selectedCategoryData?.points || 10;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setMessage({ text: 'Please select an image file', type: 'error' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ text: 'Image must be less than 5MB', type: 'error' });
        return;
      }
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveObservation = async () => {
    if (!user) {
      setMessage({ text: 'Please sign in to save observations', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | undefined;
      if (selectedPhoto) {
        setUploadingPhoto(true);
        const uploadedUrl = await uploadObservationPhoto(selectedPhoto, user.id);
        setUploadingPhoto(false);
        photoUrl = uploadedUrl ?? undefined; // Convert null to undefined
      }

      const dateToSave = observationDate ? new Date(observationDate) : new Date();
      await saveObservation({
        category: selectedCategory,
        object_name: object.name,
        notes: notes || undefined,
        location: locationName || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
        observation_date: dateToSave,
        points_awarded: pointsToEarn,
        photo_url: photoUrl,
      });
      
      // Close popup after successful save
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to save observation:', error);
      setMessage({ text: 'Failed to save observation', type: 'error' });
    } finally {
      setSaving(false);
      setUploadingPhoto(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      setMessage({ text: 'Please sign in to add favorites', type: 'error' });
      return;
    }

    try {
      if (!favorited) {
        await addToFavorites(object.type, object.id, object.name);
        setFavorited(true);
        setMessage({ text: 'Added to favorites!', type: 'success' });
      }
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ text: 'Failed to update favorites', type: 'error' });
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>
          <CloseCircle size={28} color="rgba(255,255,255,0.6)" variant="Bulk" />
        </button>
        
        <div style={styles.header}>
          <div style={styles.headerIcon}>
            {getHeaderIcon(object.type)}
          </div>
          <div>
            <h2 style={styles.title}>{object.name}</h2>
            {object.type === 'star' && object.id !== object.name && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>
                {object.id}
              </div>
            )}
            <span style={styles.type}>{object.type.toUpperCase()}</span>
          </div>
        </div>

        {/* Object Details */}
        <div style={styles.details}>
          {object.magnitude !== undefined && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Magnitude</span>
              <span style={styles.detailValue}>{object.magnitude.toFixed(2)}</span>
            </div>
          )}
          {object.ra !== undefined && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Right Ascension</span>
              <span style={styles.detailValue}>{object.ra.toFixed(4)}h</span>
            </div>
          )}
          {object.dec !== undefined && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Declination</span>
              <span style={styles.detailValue}>{object.dec.toFixed(4)}°</span>
            </div>
          )}
          {object.spectralType && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Spectral Type</span>
              <span style={styles.detailValue}>{object.spectralType}</span>
            </div>
          )}
          {object.phaseName && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Phase</span>
              <span style={styles.detailValue}>{object.phaseName}</span>
            </div>
          )}
          {object.illumination !== undefined && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Illumination</span>
              <span style={styles.detailValue}>{object.illumination.toFixed(1)}%</span>
            </div>
          )}
          {object.objectType && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Object Type</span>
              <span style={styles.detailValue}>{object.objectType}</span>
            </div>
          )}
          {object.status && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Status</span>
              <span style={styles.detailValue}>{object.status.charAt(0).toUpperCase() + object.status.slice(1)}</span>
            </div>
          )}
        </div>

        {user ? (
          <>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Log Observation</h3>
              
              <div style={styles.categoryLabel}>Category *</div>
              <div style={styles.categoryGrid}>
                {OBSERVATION_CATEGORIES.map((cat) => {
                  const IconComponent = cat.Icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      style={{
                        ...styles.categoryBtn,
                        ...(selectedCategory === cat.id ? styles.categoryBtnActive : {}),
                      }}
                    >
                      <IconComponent 
                        size={24} 
                        color={selectedCategory === cat.id ? '#a855f7' : 'rgba(255,255,255,0.5)'} 
                        variant="Bulk" 
                      />
                      <span style={styles.categoryName}>{cat.label}</span>
                      <span style={styles.categoryPoints}>+{cat.points}pts</span>
                    </button>
                  );
                })}
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    <Calendar size={14} color="rgba(255,255,255,0.7)" variant="Bulk" style={{ marginRight: 6 }} />
                    Observation Date *
                  </label>
                  <input
                    type="date"
                    value={observationDate}
                    onChange={(e) => setObservationDate(e.target.value)}
                    style={styles.dateInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    <Location size={14} color="rgba(255,255,255,0.7)" variant="Bulk" style={{ marginRight: 6 }} />
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Backyard, Observatory"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    style={styles.textInput}
                  />
                </div>
              </div>

              <label style={styles.formLabel}>Notes</label>
              <textarea
                placeholder="Describe what you observed, equipment used, sky conditions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={styles.textarea}
                rows={3}
              />

              <label style={styles.formLabel}>
                <Camera size={14} color="rgba(255,255,255,0.7)" variant="Bulk" style={{ marginRight: 6 }} />
                Photo (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
              {photoPreview ? (
                <div style={styles.photoPreviewContainer}>
                  <img src={photoPreview} alt="Preview" style={styles.photoPreview} />
                  <button 
                    onClick={handleRemovePhoto} 
                    style={styles.removePhotoBtn}
                    type="button"
                  >
                    <Trash size={16} color="#ffffff" variant="Bulk" />
                  </button>
                </div>
              ) : (
                <div 
                  style={styles.photoUploadArea}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={36} color="rgba(255,255,255,0.4)" variant="Bulk" />
                  <div style={styles.photoUploadText}>Click to upload photo</div>
                  <div style={styles.photoUploadHint}>Max 5MB, JPG/PNG</div>
                </div>
              )}
            </div>

            <div style={styles.footer}>
              <div style={styles.pointsIndicator}>
                <Star size={32} color="#ffd700" variant="Bulk" />
                <div>
                  <div style={styles.pointsLabel}>Points to earn</div>
                  <div style={styles.pointsValue}>+{pointsToEarn}</div>
                </div>
              </div>
              <button 
                onClick={handleSaveObservation} 
                style={styles.saveBtn}
                disabled={saving || uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <>Uploading...</>
                ) : saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <TickCircle size={18} color="#ffffff" variant="Bulk" style={{ marginRight: 8 }} />
                    Log Observation
                  </>
                )}
              </button>
            </div>

            <button 
              onClick={handleToggleFavorite} 
              style={{...styles.favoriteBtn, ...(favorited ? styles.favoriteBtnActive : {})}}
            >
              <Star size={18} color={favorited ? '#ffc107' : 'rgba(255,255,255,0.8)'} variant={favorited ? 'Bulk' : 'Linear'} style={{ marginRight: 8 }} />
              {favorited ? 'Favorited' : 'Add to Favorites'}
            </button>
          </>
        ) : (
          <div style={styles.signInPrompt}>
            <Lock size={40} color="rgba(255,255,255,0.4)" variant="Bulk" />
            <div>Sign in to log observations and earn points</div>
          </div>
        )}

        {message && (
          <div style={{
            ...styles.message,
            ...(message.type === 'error' ? styles.messageError : {}),
          }}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  panel: {
    background: 'linear-gradient(180deg, rgba(15, 10, 30, 0.98) 0%, rgba(5, 5, 15, 0.98) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '24px',
    width: '90%',
    maxWidth: '480px',
    maxHeight: '85vh',
    overflow: 'auto',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
  },
  headerIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '4px',
  },
  type: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '24px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '16px',
  },
  categoryLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '10px',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
    marginBottom: '16px',
  },
  categoryBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '14px 8px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  categoryBtnActive: {
    background: 'rgba(168, 85, 247, 0.15)',
    border: '1px solid rgba(168, 85, 247, 0.4)',
    color: '#ffffff',
  },
  categoryName: {
    fontSize: '12px',
    fontWeight: 500,
  },
  categoryPoints: {
    fontSize: '10px',
    opacity: 0.7,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  formLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  dateInput: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  textInput: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px',
    padding: '12px',
    color: '#ffffff',
    fontSize: '13px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    marginBottom: '12px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    marginBottom: '12px',
  },
  pointsIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  pointsLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  pointsValue: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#ffffff',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 24px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtn: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtnActive: {
    background: 'rgba(255, 193, 7, 0.15)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    color: '#ffc107',
  },
  signInPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '32px 20px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
    textAlign: 'center',
  },
  message: {
    marginTop: '16px',
    padding: '12px',
    background: 'rgba(81, 207, 102, 0.15)',
    border: '1px solid rgba(81, 207, 102, 0.3)',
    borderRadius: '10px',
    color: '#51cf66',
    fontSize: '13px',
    textAlign: 'center',
  },
  messageError: {
    background: 'rgba(255, 107, 107, 0.15)',
    border: '1px solid rgba(255, 107, 107, 0.3)',
    color: '#ff6b6b',
  },
  photoUploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '24px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '2px dashed rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '16px',
  },
  photoUploadText: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 500,
  },
  photoUploadHint: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  photoPreviewContainer: {
    position: 'relative',
    marginBottom: '16px',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    maxHeight: '200px',
    objectFit: 'cover',
    borderRadius: '12px',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '32px',
    height: '32px',
    background: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
