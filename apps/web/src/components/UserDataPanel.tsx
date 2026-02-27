/**
 * User Data Panel Component
 * Shows user's observations and favorites
 * Example component - integrate into your UI as needed
 */

import { useState, useEffect } from 'react';
import { getUserObservations, getUserFavorites } from '../services/supabase-service';
import type { UserObservation, UserFavorite } from '../services/supabase-service';

interface UserDataPanelProps {
  onClose: () => void;
}

export default function UserDataPanel({ onClose }: UserDataPanelProps) {
  const [activeTab, setActiveTab] = useState<'observations' | 'favorites'>('observations');
  const [observations, setObservations] = useState<UserObservation[]>([]);
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [obs, favs] = await Promise.all([
        getUserObservations(),
        getUserFavorites(),
      ]);
      setObservations(obs);
      setFavorites(favs);
    } catch (error) {
      console.error('Failed to load user data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>×</button>
        
        <h2 style={styles.title}>My Sky Data</h2>

        <div style={styles.tabs}>
          <button
            style={{...styles.tab, ...(activeTab === 'observations' ? styles.tabActive : {})}}
            onClick={() => setActiveTab('observations')}
          >
            📝 Observations ({observations.length})
          </button>
          <button
            style={{...styles.tab, ...(activeTab === 'favorites' ? styles.tabActive : {})}}
            onClick={() => setActiveTab('favorites')}
          >
            ⭐ Favorites ({favorites.length})
          </button>
        </div>

        <div style={styles.content}>
          {loading ? (
            <div style={styles.loading}>Loading...</div>
          ) : activeTab === 'observations' ? (
            <div style={styles.list}>
              {observations.length === 0 ? (
                <div style={styles.empty}>No observations yet. Click on celestial objects to log observations!</div>
              ) : (
                observations.map((obs) => (
                  <div key={obs.id} style={styles.item}>
                    <div style={styles.itemHeader}>
                      <span style={styles.itemName}>{obs.object_name}</span>
                      <span style={styles.itemType}>{obs.category}</span>
                    </div>
                    {obs.notes && <div style={styles.itemNotes}>{obs.notes}</div>}
                    <div style={styles.itemFooter}>
                      <span style={styles.itemDate}>
                        {new Date(obs.observation_date).toLocaleDateString()} at{' '}
                        {new Date(obs.observation_date).toLocaleTimeString()}
                      </span>
                      {obs.location && (
                        <span style={styles.itemLocation}>
                          📍 {obs.location}
                        </span>
                      )}
                    </div>
                    {obs.points_awarded > 0 && (
                      <div style={styles.itemPoints}>
                        🏆 {obs.points_awarded} points
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={styles.list}>
              {favorites.length === 0 ? (
                <div style={styles.empty}>No favorites yet. Add objects to your favorites!</div>
              ) : (
                favorites.map((fav) => (
                  <div key={fav.id} style={styles.item}>
                    <div style={styles.itemHeader}>
                      <span style={styles.itemName}>{fav.object_name}</span>
                      <span style={styles.itemType}>{fav.object_type}</span>
                    </div>
                    <div style={styles.itemFooter}>
                      <span style={styles.itemDate}>
                        Added {new Date(fav.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
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
    zIndex: 1000,
  },
  panel: {
    background: 'rgba(0, 8, 20, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '700px',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '28px',
    cursor: 'pointer',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '20px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  tab: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    color: '#ffffff',
    borderBottom: '2px solid rgba(99, 102, 241, 0.8)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  item: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '16px',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  itemName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  itemType: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  itemNotes: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '8px',
    lineHeight: '1.5',
  },
  itemFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  itemDate: {
    fontSize: '11px',
  },
  itemLocation: {
    fontSize: '11px',
  },
  itemPoints: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#ffc107',
    fontWeight: 500,
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px',
  },
};
