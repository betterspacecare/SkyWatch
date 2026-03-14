/**
 * Object Detail Panel Component
 * Shows details about clicked celestial objects with Info tabs and observation logging
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { saveObservation, addToFavorites, isFavorited, uploadObservationPhoto } from '../services/supabase-service';
import { getCelestialInfoWithFallback, CelestialInfo } from '../services/celestial-info-service';
import { getOrGenerateCelestialInfo } from '../services/celestial-ai-service';
import { getCelestialImage, CelestialImage } from '../services/celestial-images';
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
  Book1,
  Notepad2,
  InfoCircle,
  Microscope,
  Story,
  MagicStar,
  Cpu,
  Image,
} from 'iconsax-react';

const OBSERVATION_CATEGORIES = [
  { id: 'Moon', label: 'Moon', Icon: Moon, points: 5 },
  { id: 'Planet', label: 'Planet', Icon: Global, points: 10 },
  { id: 'Nebula', label: 'Nebula', Icon: Magicpen, points: 20 },
  { id: 'Galaxy', label: 'Galaxy', Icon: Global, points: 25 },
  { id: 'Cluster', label: 'Cluster', Icon: Star, points: 15 },
  { id: 'Constellation', label: 'Constellation', Icon: Star1, points: 8 },
] as const;

type ObservationCategory = typeof OBSERVATION_CATEGORIES[number]['id'];
type TabType = 'info' | 'observe';
type InfoSection = 'science' | 'mythology' | 'astrology' | 'tips';

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

function getDefaultCategory(objectType: string, deepSkyType?: string): ObservationCategory {
  switch (objectType) {
    case 'moon': return 'Moon';
    case 'planet':
    case 'sun': return 'Planet';
    case 'constellation': return 'Constellation';
    case 'deepsky':
    case 'messier':
      if (deepSkyType) {
        if (deepSkyType.toLowerCase().includes('galaxy')) return 'Galaxy';
        if (deepSkyType.toLowerCase().includes('nebula')) return 'Nebula';
        if (deepSkyType.toLowerCase().includes('cluster')) return 'Cluster';
      }
      return 'Nebula';
    default: return 'Constellation';
  }
}

function getHeaderIcon(type: string) {
  switch (type) {
    case 'moon': return <Moon size={40} color="#e8e8e0" variant="Bulk" />;
    case 'sun': return <Sun1 size={40} color="#ffcc00" variant="Bulk" />;
    case 'planet': return <Global size={40} color="#ffdd44" variant="Bulk" />;
    case 'deepsky':
    case 'messier': return <Magicpen size={40} color="#a855f7" variant="Bulk" />;
    case 'constellation': return <Star1 size={40} color="#6699ff" variant="Bulk" />;
    default: return <Star size={40} color="#ffffff" variant="Bulk" />;
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
  const [observationDate, setObservationDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationName, setLocationName] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New state for tabs and info
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [activeInfoSection, setActiveInfoSection] = useState<InfoSection>('science');
  const [celestialInfo, setCelestialInfo] = useState<CelestialInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [generatingInfo, setGeneratingInfo] = useState(false);
  
  // State for celestial image
  const [celestialImage, setCelestialImage] = useState<CelestialImage | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        isFavorited(object.type, object.id).then(setFavorited);
      }
    });
  }, [object.type, object.id]);

  // Fetch celestial image
  useEffect(() => {
    let cancelled = false;
    
    async function fetchImage() {
      setImageLoading(true);
      setImageError(false);
      setCelestialImage(null);
      
      try {
        const image = await getCelestialImage(
          object.type as any,
          object.id,
          object.ra,
          object.dec
        );
        
        if (!cancelled) {
          setCelestialImage(image);
          setImageLoading(false);
        }
      } catch (error) {
        console.error('Error fetching celestial image:', error);
        if (!cancelled) {
          setImageError(true);
          setImageLoading(false);
        }
      }
    }
    
    fetchImage();
    return () => { cancelled = true; };
  }, [object.type, object.id, object.ra, object.dec]);

  // Fetch celestial info - first try DB/fallback, then AI if needed
  useEffect(() => {
    let cancelled = false;
    
    async function fetchInfo() {
      setLoadingInfo(true);
      setGeneratingInfo(false);
      
      // First try database and hardcoded fallback
      const info = await getCelestialInfoWithFallback(object.type, object.id);
      
      if (cancelled) return;
      
      if (info) {
        setCelestialInfo(info);
        setLoadingInfo(false);
        return;
      }
      
      // No info found - try AI generation
      setLoadingInfo(false);
      setGeneratingInfo(true);
      
      try {
        const aiInfo = await getOrGenerateCelestialInfo(object.type, object.id, object.name);
        if (!cancelled && aiInfo) {
          setCelestialInfo(aiInfo);
        }
      } catch (error) {
        console.error('Error generating info:', error);
      } finally {
        if (!cancelled) {
          setGeneratingInfo(false);
        }
      }
    }
    
    fetchInfo();
    return () => { cancelled = true; };
  }, [object.type, object.id, object.name]);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        photoUrl = uploadedUrl ?? undefined;
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
      setTimeout(() => onClose(), 500);
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

  // Render info section content
  const renderInfoSection = () => {
    if (loadingInfo) {
      return <div style={styles.loadingInfo}>Loading information...</div>;
    }
    
    if (generatingInfo) {
      return (
        <div style={styles.generatingInfo}>
          <Cpu size={32} color="#a855f7" variant="Bulk" style={{ animation: 'pulse 1.5s infinite' }} />
          <p>Generating information with AI...</p>
          <p style={{ fontSize: '12px', opacity: 0.6 }}>This will be saved for future visitors.</p>
        </div>
      );
    }
    
    if (!celestialInfo) {
      return (
        <div style={styles.noInfo}>
          <InfoCircle size={32} color="rgba(255,255,255,0.3)" variant="Bulk" />
          <p>No detailed information available for this object yet.</p>
          <p style={{ fontSize: '12px', opacity: 0.6 }}>Configure Gemini API to enable AI-generated content.</p>
        </div>
      );
    }

    switch (activeInfoSection) {
      case 'science':
        return (
          <div style={styles.infoContent}>
            {celestialInfo.science_summary && (
              <p style={styles.infoSummary}>{celestialInfo.science_summary}</p>
            )}
            {celestialInfo.distance && (
              <div style={styles.infoDetail}>
                <span style={styles.infoDetailLabel}>Distance:</span>
                <span style={styles.infoDetailValue}>{celestialInfo.distance}</span>
              </div>
            )}
            {celestialInfo.science_facts && celestialInfo.science_facts.length > 0 && (
              <div style={styles.factsList}>
                <h4 style={styles.factsTitle}>Scientific Facts</h4>
                {celestialInfo.science_facts.map((fact, i) => (
                  <div key={i} style={styles.factItem}>
                    <span style={styles.factBullet}>•</span>
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            )}
            {celestialInfo.notable_stars && celestialInfo.notable_stars.length > 0 && (
              <div style={styles.notableSection}>
                <h4 style={styles.factsTitle}>Notable Stars</h4>
                {celestialInfo.notable_stars.map((star, i) => (
                  <div key={i} style={styles.notableItem}>
                    <span style={styles.notableName}>{star.name}</span>
                    <span style={styles.notableDesc}>{star.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'mythology':
        return (
          <div style={styles.infoContent}>
            {celestialInfo.mythology_summary && (
              <p style={styles.infoSummary}>{celestialInfo.mythology_summary}</p>
            )}
            {celestialInfo.origin_culture && (
              <div style={styles.infoDetail}>
                <span style={styles.infoDetailLabel}>Origin:</span>
                <span style={styles.infoDetailValue}>{celestialInfo.origin_culture}</span>
              </div>
            )}
            {celestialInfo.indian_mythology && (
              <div style={styles.indianMythology}>
                <h4 style={styles.factsTitle}>🙏 Indian Mythology</h4>
                <p style={styles.infoSummary}>{celestialInfo.indian_mythology}</p>
              </div>
            )}
            {celestialInfo.mythology_facts && celestialInfo.mythology_facts.length > 0 && (
              <div style={styles.factsList}>
                <h4 style={styles.factsTitle}>Mythology & Legends</h4>
                {celestialInfo.mythology_facts.map((fact, i) => (
                  <div key={i} style={styles.factItem}>
                    <span style={styles.factBullet}>•</span>
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'astrology':
        return (
          <div style={styles.infoContent}>
            <div style={styles.astrologyDisclaimer}>
              <InfoCircle size={16} color="#fbbf24" variant="Bulk" />
              <span>Astrology is not scientifically validated. This section is for cultural reference only.</span>
            </div>
            {celestialInfo.zodiac_sign && (
              <div style={styles.infoDetail}>
                <span style={styles.infoDetailLabel}>Zodiac Sign:</span>
                <span style={styles.infoDetailValue}>{celestialInfo.zodiac_sign}</span>
              </div>
            )}
            {celestialInfo.astrology_summary && (
              <p style={styles.infoSummary}>{celestialInfo.astrology_summary}</p>
            )}
            {celestialInfo.astrology_facts && celestialInfo.astrology_facts.length > 0 && (
              <div style={styles.factsList}>
                {celestialInfo.astrology_facts.map((fact, i) => (
                  <div key={i} style={styles.factItem}>
                    <span style={styles.factBullet}>•</span>
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            )}
            {!celestialInfo.astrology_summary && (!celestialInfo.astrology_facts || celestialInfo.astrology_facts.length === 0) && (
              <p style={styles.noSectionInfo}>No astrological information available.</p>
            )}
          </div>
        );
      case 'tips':
        return (
          <div style={styles.infoContent}>
            {celestialInfo.best_viewing_season && (
              <div style={styles.infoDetail}>
                <span style={styles.infoDetailLabel}>Best Season:</span>
                <span style={styles.infoDetailValue}>{celestialInfo.best_viewing_season}</span>
              </div>
            )}
            {celestialInfo.best_viewing_conditions && (
              <div style={styles.infoDetail}>
                <span style={styles.infoDetailLabel}>Conditions:</span>
                <span style={styles.infoDetailValue}>{celestialInfo.best_viewing_conditions}</span>
              </div>
            )}
            {celestialInfo.observation_tips && celestialInfo.observation_tips.length > 0 && (
              <div style={styles.factsList}>
                <h4 style={styles.factsTitle}>Observation Tips</h4>
                {celestialInfo.observation_tips.map((tip, i) => (
                  <div key={i} style={styles.factItem}>
                    <span style={styles.factBullet}>💡</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
            {celestialInfo.notable_deepsky && celestialInfo.notable_deepsky.length > 0 && (
              <div style={styles.notableSection}>
                <h4 style={styles.factsTitle}>Deep Sky Objects to Find</h4>
                {celestialInfo.notable_deepsky.map((obj, i) => (
                  <div key={i} style={styles.notableItem}>
                    <span style={styles.notableName}>{obj.id} - {obj.name}</span>
                    <span style={styles.notableDesc}>{obj.type}: {obj.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>
          <CloseCircle size={28} color="rgba(255,255,255,0.6)" variant="Bulk" />
        </button>
        
        <div style={styles.header}>
          <div style={styles.headerIcon}>{getHeaderIcon(object.type)}</div>
          <div>
            <h2 style={styles.title}>{object.name}</h2>
            {object.type === 'star' && object.id !== object.name && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '2px' }}>{object.id}</div>
            )}
            <span style={styles.type}>{object.type.toUpperCase()}</span>
          </div>
        </div>

        {/* Celestial Image Section */}
        {(imageLoading || celestialImage) && (
          <div style={styles.celestialImageSection}>
            <div 
              style={styles.celestialImageContainer}
              onClick={() => celestialImage && !imageLoading && setShowFullImage(true)}
            >
              {imageLoading ? (
                <div style={styles.imageLoading}>
                  <Image size={32} color="rgba(255,255,255,0.3)" variant="Bulk" />
                  <span>Searching NASA archives...</span>
                </div>
              ) : imageError || !celestialImage ? (
                <div style={styles.imageError}>
                  <Image size={32} color="rgba(255,255,255,0.2)" variant="Bulk" />
                  <span>No image available</span>
                </div>
              ) : (
                <>
                  <img 
                    src={celestialImage.thumbnail || celestialImage.url} 
                    alt={celestialImage.title}
                    style={styles.celestialImageThumb}
                    onError={() => setImageError(true)}
                  />
                  <div style={styles.imageOverlay}>
                    <Image size={20} color="#ffffff" variant="Bulk" />
                    <span>View Full Image</span>
                  </div>
                </>
              )}
            </div>
            {celestialImage && !imageLoading && !imageError && (
              <div style={styles.celestialImageCredit}>
                📷 {celestialImage.credit}
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={styles.tabNav}>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'info' ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab('info')}
          >
            <Book1 size={18} color={activeTab === 'info' ? '#a855f7' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
            <span>Info</span>
          </button>
          <button
            style={{ ...styles.tabBtn, ...(activeTab === 'observe' ? styles.tabBtnActive : {}) }}
            onClick={() => setActiveTab('observe')}
          >
            <Notepad2 size={18} color={activeTab === 'observe' ? '#a855f7' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
            <span>Log Observation</span>
          </button>
        </div>

        {activeTab === 'info' ? (
          <>
            {/* Celestial Image */}
            {celestialImage && (
              <div style={styles.imageSection}>
                <div 
                  style={styles.imageContainer}
                  onClick={() => setShowFullImage(true)}
                >
                  {imageLoading && (
                    <div style={styles.imageLoading}>
                      <Image size={32} color="rgba(255,255,255,0.3)" variant="Bulk" />
                      <span>Loading image...</span>
                    </div>
                  )}
                  <img 
                    src={celestialImage.url} 
                    alt={celestialImage.title}
                    style={{
                      ...styles.celestialImage,
                      display: imageError ? 'none' : 'block',
                    }}
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                  />
                  {imageError && (
                    <div style={styles.imageError}>
                      <Image size={32} color="rgba(255,255,255,0.2)" variant="Bulk" />
                      <span>Image unavailable</span>
                    </div>
                  )}
                  {!imageLoading && !imageError && (
                    <div style={styles.imageOverlay}>
                      <span>Click to enlarge</span>
                    </div>
                  )}
                </div>
                <div style={styles.imageCredit}>
                  📷 {celestialImage.credit}
                </div>
              </div>
            )}
            
            {/* Info Section Tabs */}
            <div style={styles.infoSectionNav}>
              <button
                style={{ ...styles.infoSectionBtn, ...(activeInfoSection === 'science' ? styles.infoSectionBtnActive : {}) }}
                onClick={() => setActiveInfoSection('science')}
              >
                <Microscope size={14} color={activeInfoSection === 'science' ? '#60a5fa' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
                Science
              </button>
              <button
                style={{ ...styles.infoSectionBtn, ...(activeInfoSection === 'mythology' ? styles.infoSectionBtnActive : {}) }}
                onClick={() => setActiveInfoSection('mythology')}
              >
                <Story size={14} color={activeInfoSection === 'mythology' ? '#f472b6' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
                Mythology
              </button>
              <button
                style={{ ...styles.infoSectionBtn, ...(activeInfoSection === 'astrology' ? styles.infoSectionBtnActive : {}) }}
                onClick={() => setActiveInfoSection('astrology')}
              >
                <MagicStar size={14} color={activeInfoSection === 'astrology' ? '#fbbf24' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
                Astrology
              </button>
              <button
                style={{ ...styles.infoSectionBtn, ...(activeInfoSection === 'tips' ? styles.infoSectionBtnActive : {}) }}
                onClick={() => setActiveInfoSection('tips')}
              >
                <Star1 size={14} color={activeInfoSection === 'tips' ? '#34d399' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
                Tips
              </button>
            </div>
            {renderInfoSection()}
            
            {/* Quick action buttons */}
            <div style={styles.quickActions}>
              <button onClick={() => setActiveTab('observe')} style={styles.quickActionBtn}>
                <Notepad2 size={18} color="#a855f7" variant="Bulk" />
                Log This Observation
              </button>
              <button onClick={handleToggleFavorite} style={{ ...styles.quickActionBtn, ...(favorited ? styles.quickActionBtnActive : {}) }}>
                <Star size={18} color={favorited ? '#ffc107' : 'rgba(255,255,255,0.7)'} variant={favorited ? 'Bulk' : 'Linear'} />
                {favorited ? 'Favorited' : 'Add to Favorites'}
              </button>
            </div>
          </>
        ) : (
          <>
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
            </div>

            {user ? (
              <>
                <div style={styles.section}>
                  <div style={styles.categoryLabel}>Category *</div>
                  <div style={styles.categoryGrid}>
                    {OBSERVATION_CATEGORIES.map((cat) => {
                      const IconComponent = cat.Icon;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          style={{ ...styles.categoryBtn, ...(selectedCategory === cat.id ? styles.categoryBtnActive : {}) }}
                        >
                          <IconComponent size={24} color={selectedCategory === cat.id ? '#a855f7' : 'rgba(255,255,255,0.5)'} variant="Bulk" />
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
                        Date *
                      </label>
                      <input type="date" value={observationDate} onChange={(e) => setObservationDate(e.target.value)} style={styles.dateInput} />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        <Location size={14} color="rgba(255,255,255,0.7)" variant="Bulk" style={{ marginRight: 6 }} />
                        Location
                      </label>
                      <input type="text" placeholder="e.g. Backyard" value={locationName} onChange={(e) => setLocationName(e.target.value)} style={styles.textInput} />
                    </div>
                  </div>

                  <label style={styles.formLabel}>Notes</label>
                  <textarea placeholder="Describe what you observed..." value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea} rows={3} />

                  <label style={styles.formLabel}>
                    <Camera size={14} color="rgba(255,255,255,0.7)" variant="Bulk" style={{ marginRight: 6 }} />
                    Photo (Optional)
                  </label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                  {photoPreview ? (
                    <div style={styles.photoPreviewContainer}>
                      <img src={photoPreview} alt="Preview" style={styles.photoPreview} />
                      <button onClick={handleRemovePhoto} style={styles.removePhotoBtn} type="button">
                        <Trash size={16} color="#ffffff" variant="Bulk" />
                      </button>
                    </div>
                  ) : (
                    <div style={styles.photoUploadArea} onClick={() => fileInputRef.current?.click()}>
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
                  <button onClick={handleSaveObservation} style={styles.saveBtn} disabled={saving || uploadingPhoto}>
                    {uploadingPhoto ? 'Uploading...' : saving ? 'Saving...' : (
                      <><TickCircle size={18} color="#ffffff" variant="Bulk" style={{ marginRight: 8 }} />Log Observation</>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div style={styles.signInPrompt}>
                <Lock size={40} color="rgba(255,255,255,0.4)" variant="Bulk" />
                <div>Sign in to log observations and earn points</div>
              </div>
            )}
          </>
        )}

        {message && (
          <div style={{ ...styles.message, ...(message.type === 'error' ? styles.messageError : {}) }}>
            {message.text}
          </div>
        )}
      </div>

      {/* Full Image Modal */}
      {showFullImage && celestialImage && (
        <div style={styles.fullImageModal} onClick={() => setShowFullImage(false)}>
          <button style={styles.fullImageClose} onClick={() => setShowFullImage(false)}>
            <CloseCircle size={32} color="#ffffff" variant="Bulk" />
          </button>
          <img 
            src={celestialImage.url} 
            alt={celestialImage.title}
            style={styles.fullImage}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={styles.fullImageCaption}>
            <div style={styles.fullImageTitle}>{celestialImage.title}</div>
            <div style={styles.fullImageCredit}>📷 {celestialImage.credit}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
  },
  panel: {
    background: 'linear-gradient(180deg, rgba(15, 10, 30, 0.98) 0%, rgba(5, 5, 15, 0.98) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '20px', padding: '24px',
    width: '90%', maxWidth: '520px', maxHeight: '85vh', overflow: 'auto', position: 'relative',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  closeBtn: {
    position: 'absolute', top: '16px', right: '16px', background: 'transparent',
    border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  headerIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: '22px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' },
  type: { fontSize: '11px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '1px' },
  
  // Tab navigation
  tabNav: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tabBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#ffffff',
  },
  
  // Info section navigation
  infoSectionNav: { display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' as const },
  infoSectionBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px', fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  infoSectionBtnActive: { background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#ffffff' },
  
  // Info content
  infoContent: { marginBottom: '16px' },
  infoSummary: { fontSize: '14px', lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.85)', marginBottom: '16px' },
  infoDetail: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', color: '#ffffff' },
  infoDetailLabel: { fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' },
  infoDetailValue: { fontSize: '13px', color: '#ffffff', textAlign: 'right' as const, maxWidth: '60%' },
  factsList: { marginTop: '16px' },
  factsTitle: { fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' },
  factItem: { display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '13px', lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.8)' },
  factBullet: { color: '#a855f7', flexShrink: 0 },
  notableSection: { marginTop: '20px' },
  indianMythology: { 
    marginTop: '16px', padding: '12px', 
    background: 'rgba(255, 153, 51, 0.1)', 
    border: '1px solid rgba(255, 153, 51, 0.2)', 
    borderRadius: '10px' 
  },
  notableItem: { display: 'flex', flexDirection: 'column' as const, gap: '4px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', marginBottom: '8px' },
  notableName: { fontSize: '13px', fontWeight: 600, color: '#ffffff' },
  notableDesc: { fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' },
  loadingInfo: { padding: '40px 20px', textAlign: 'center' as const, color: 'rgba(255, 255, 255, 0.5)' },
  generatingInfo: { 
    padding: '40px 20px', textAlign: 'center' as const, color: 'rgba(255, 255, 255, 0.7)', 
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '12px',
    background: 'rgba(168, 85, 247, 0.1)', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.2)',
  },
  noInfo: { padding: '40px 20px', textAlign: 'center' as const, color: 'rgba(255, 255, 255, 0.5)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '12px' },
  noSectionInfo: { fontSize: '13px', color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' as const },
  astrologyDisclaimer: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px',
    background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '8px',
    fontSize: '11px', color: 'rgba(251, 191, 36, 0.9)',
  },
  
  // Quick actions
  quickActions: { display: 'flex', gap: '10px', marginTop: '16px' },
  quickActionBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.8)', fontSize: '12px', fontWeight: 500,
  },
  quickActionBtnActive: { background: 'rgba(255, 193, 7, 0.15)', border: '1px solid rgba(255, 193, 7, 0.3)', color: '#ffc107' },

  // Existing styles
  details: {
    display: 'flex', flexDirection: 'column' as const, gap: '10px', marginBottom: '20px', padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' },
  detailValue: { fontSize: '14px', fontWeight: 500, color: '#ffffff' },
  section: { marginBottom: '20px' },
  categoryLabel: { fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '10px' },
  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' },
  categoryBtn: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '6px', padding: '14px 8px',
    background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px',
    cursor: 'pointer', transition: 'all 0.2s ease', color: 'rgba(255, 255, 255, 0.7)',
  },
  categoryBtnActive: { background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#ffffff' },
  categoryName: { fontSize: '12px', fontWeight: 500 },
  categoryPoints: { fontSize: '10px', opacity: 0.7 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
  formLabel: { fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '4px', display: 'flex', alignItems: 'center' },
  dateInput: {
    background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px',
    padding: '10px 12px', color: '#ffffff', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
  },
  textInput: {
    background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px',
    padding: '10px 12px', color: '#ffffff', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
  },
  textarea: {
    width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '10px', padding: '12px', color: '#ffffff', fontSize: '13px', fontFamily: 'inherit',
    resize: 'vertical' as const, outline: 'none', marginBottom: '12px',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', marginBottom: '12px',
  },
  pointsIndicator: { display: 'flex', alignItems: 'center', gap: '10px' },
  pointsLabel: { fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  pointsValue: { fontSize: '18px', fontWeight: 700, color: '#ffffff' },
  saveBtn: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', border: 'none', borderRadius: '12px',
    padding: '14px 24px', color: '#ffffff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  signInPrompt: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '12px',
    padding: '32px 20px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', textAlign: 'center' as const,
  },
  message: {
    marginTop: '16px', padding: '12px', background: 'rgba(81, 207, 102, 0.15)',
    border: '1px solid rgba(81, 207, 102, 0.3)', borderRadius: '10px', color: '#51cf66', fontSize: '13px', textAlign: 'center' as const,
  },
  messageError: { background: 'rgba(255, 107, 107, 0.15)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#ff6b6b' },
  photoUploadArea: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '24px', background: 'rgba(255, 255, 255, 0.03)', border: '2px dashed rgba(255, 255, 255, 0.15)',
    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s ease', marginBottom: '16px',
  },
  photoUploadText: { fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 },
  photoUploadHint: { fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' },
  photoPreviewContainer: { position: 'relative' as const, marginBottom: '16px', borderRadius: '12px', overflow: 'hidden' },
  photoPreview: { width: '100%', maxHeight: '200px', objectFit: 'cover' as const, borderRadius: '12px' },
  removePhotoBtn: {
    position: 'absolute' as const, top: '8px', right: '8px', width: '32px', height: '32px',
    background: 'rgba(0, 0, 0, 0.7)', border: 'none', borderRadius: '50%', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  
  // Celestial Image styles
  celestialImageSection: {
    marginBottom: '16px',
  },
  celestialImageContainer: {
    position: 'relative' as const,
    width: '100%',
    height: '160px',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'rgba(0, 0, 0, 0.3)',
  },
  celestialImageThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transition: 'transform 0.3s ease',
  },
  imageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 500,
    opacity: 0.8,
    transition: 'opacity 0.2s ease',
  },
  imageLoading: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
  },
  imageError: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'rgba(255,255,255,0.3)',
    fontSize: '12px',
  },
  celestialImageCredit: {
    marginTop: '6px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center' as const,
  },
  
  // Full Image Modal styles
  fullImageModal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20000,
    padding: '20px',
  },
  fullImageClose: {
    position: 'absolute' as const,
    top: '20px',
    right: '20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease',
  },
  fullImage: {
    maxWidth: '90vw',
    maxHeight: '75vh',
    objectFit: 'contain' as const,
    borderRadius: '8px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  fullImageCaption: {
    marginTop: '16px',
    textAlign: 'center' as const,
  },
  fullImageTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '4px',
  },
  fullImageCredit: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
};
