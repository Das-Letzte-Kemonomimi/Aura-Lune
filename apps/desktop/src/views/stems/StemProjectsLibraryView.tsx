import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Play,
  Trash2,
  Edit3,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { StemProject, StemProjectProgressPayload } from '../../types/analysis';
import { formatBytes } from '../../utils/fileSizeFormat';
import { getTranslations, type Language } from '../../i18n';

interface StemProjectsLibraryViewProps {
  onOpenProject: (projectId: number) => void;
  onOpenCreateProject?: () => void;
  currentLang?: Language;
}

export const StemProjectsLibraryView: React.FC<StemProjectsLibraryViewProps> = ({
  onOpenProject,
  onOpenCreateProject,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const [projects, setProjects] = useState<StemProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await invoke<StemProject[]>('list_stem_projects');
      setProjects(list);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();

    let unlisten: (() => void) | undefined;
    listen<StemProjectProgressPayload>('auralune://stem-project-progress', (event) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === event.payload.project_id) {
            return {
              ...p,
              status: event.payload.status as any,
              progress: event.payload.progress,
            };
          }
          return p;
        })
      );

      if (event.payload.status === 'ready') {
        loadProjects();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [loadProjects]);

  const handleDelete = async (projectId: number, title: string) => {
    if (!window.confirm(t.stems.deleteConfirm.replace('{0}', title))) {
      return;
    }
    try {
      await invoke('delete_stem_project', { projectId });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err: any) {
      alert(t.stems.deleteError.replace('{0}', String(err)));
    }
  };

  const handleStartRename = (project: StemProject) => {
    setEditingProjectId(project.id);
    setEditingTitle(project.title);
  };

  const handleSaveRename = async (projectId: number) => {
    if (!editingTitle.trim()) return;
    try {
      await invoke('rename_stem_project', {
        projectId,
        title: editingTitle.trim(),
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, title: editingTitle.trim() } : p))
      );
      setEditingProjectId(null);
    } catch (err: any) {
      alert(t.stems.renameError.replace('{0}', String(err)));
    }
  };

  return (
    <div style={{ padding: '24px 0', width: '100%' }}>
      {/* Nagłówek sekcji biblioteki */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
            {t.stems.title}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            {t.stems.subtitle}
          </p>
        </div>

        {onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.3)',
            }}
          >
            <Layers size={16} />
            {t.stems.newProject}
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Sparkles size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          <div>{t.stems.loadingProjects}</div>
        </div>
      ) : projects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '70px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '20px',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'rgba(236, 72, 153, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--accent-pink)',
            }}
          >
            <Layers size={32} />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#f8fafc' }}>
            {t.stems.noProjects}
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '480px', marginInline: 'auto' }}>
            {t.stems.noProjectsDesc}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}
        >
          {projects.map((project) => (
            <div
              key={project.id}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Tytuł i status */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingProjectId === project.id ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(project.id);
                          if (e.key === 'Escape') setEditingProjectId(null);
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid var(--accent-pink)',
                          color: '#ffffff',
                          fontSize: '0.9rem',
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(project.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'var(--accent-pink)',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                      onClick={() => onOpenProject(project.id)}
                      title={project.title}
                    >
                      {project.title}
                    </h3>
                  )}

                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {project.artist} • {project.album}
                  </p>
                </div>

                {/* Status Badge */}
                <div>
                  {project.status === 'ready' ? (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: 'rgba(52, 211, 153, 0.15)',
                        border: '1px solid rgba(52, 211, 153, 0.3)',
                        color: '#34d399',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {t.stems.statusReady}
                    </span>
                  ) : project.status === 'separating' ? (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#f59e0b',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={10} className="animate-spin" />
                      {t.stems.statusSeparating.replace('{0}', String(Math.round(project.progress * 100)))}
                    </span>
                  ) : project.status === 'failed' ? (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {t.stems.statusFailed}
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '8px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {t.stems.statusQueued}
                    </span>
                  )}
                </div>
              </div>

              {/* Informacje techniczne */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingTop: '8px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={13} /> {t.stems.tracksCount.replace('{0}', String(project.channels.length))}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <HardDrive size={13} /> {formatBytes(project.disk_size_bytes)}
                </span>
              </div>

              {/* Przyciski akcji */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  paddingTop: '6px',
                }}
              >
                <button
                  onClick={() => onOpenProject(project.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Play size={14} fill="#ffffff" />
                  {t.stems.openStudio}
                </button>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleStartRename(project)}
                    title={t.stems.renameProject}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                    }}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.title)}
                    title={t.stems.deleteProject}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
