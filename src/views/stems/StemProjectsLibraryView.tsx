import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Play,
  Trash2,
  Edit3,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { StemProject, StemProjectProgressPayload } from '../../types/analysis';
import { formatBytes } from '../../utils/fileSizeFormat';
import { getTranslations, type Language } from '../../i18n';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { fmt } from '../../utils/fmt';
import { Callout } from '../../components/ui';

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
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useTauriEvent<StemProjectProgressPayload>('auralune://stem-project-progress', (payload) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === payload.project_id
          ? { ...p, status: payload.status as any, progress: payload.progress }
          : p
      )
    );
    if (payload.status === 'ready') {
      loadProjects();
    }
  });

  const handleDelete = async (projectId: number, title: string) => {
    if (!window.confirm(fmt(t.stems.deleteConfirm, title))) {
      return;
    }
    try {
      await invoke('delete_stem_project', { projectId });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err: unknown) {
      alert(fmt(t.stems.deleteError, String(err)));
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
    } catch (err: unknown) {
      alert(fmt(t.stems.renameError, String(err)));
    }
  };

  return (
    <div className="w-full px-0 py-6">
      {/* Library section header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="m-0 text-2xl font-extrabold text-fg">
            {t.stems.title}
          </h2>
          <p className="mx-0 mt-1 mb-0 text-sm text-fg-secondary">
            {t.stems.subtitle}
          </p>
        </div>

        {onOpenCreateProject && (
          <button
            onClick={onOpenCreateProject}
            className="flex items-center gap-1.5 rounded-xl border-0 bg-linear-135 from-pink-500 to-violet-500 px-4 py-2 text-sm font-bold text-fg shadow-lift shadow-pink-500/30"
          >
            <Layers size={16} />
            {t.stems.newProject}
          </button>
        )}
      </div>

      {error && (
        <Callout tone="red" className="mb-4 text-sm text-red-400">
          {error}
        </Callout>
      )}

      {loading && projects.length === 0 ? (
        <div className="px-0 py-15 text-center text-fg-secondary">
          <Sparkles size={28} className="mx-auto mt-0 mb-3 animate-spin" />
          <div>{t.stems.loadingProjects}</div>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/2 px-5 py-17.5 text-center">
          <div
            className="mx-auto mt-0 mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-pink-500/10 text-accent-pink"
          >
            <Layers size={32} />
          </div>
          <h3 className="mx-0 mt-0 mb-2 text-lg text-fg">
            {t.stems.noProjects}
          </h3>
          <p className="mx-0 mt-0 mb-5 mx-auto max-w-120 text-sm text-fg-secondary">
            {t.stems.noProjectsDesc}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))] gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-slate-900/75 p-4 transition-all duration-200"
            >
              {/* Title and status */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  {editingProjectId === project.id ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(project.id);
                          if (e.key === 'Escape') setEditingProjectId(null);
                        }}
                        className="flex-1 rounded-md border border-accent-pink bg-white/10 px-2 py-1 text-sm text-fg"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(project.id)}
                        className="rounded-md border-0 bg-accent-pink px-2 py-1 font-bold text-on-accent"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <h3
                      className="m-0 cursor-pointer truncate text-base font-extrabold text-fg"
                      onClick={() => onOpenProject(project.id)}
                      title={project.title}
                    >
                      {project.title}
                    </h3>
                  )}

                  <p className="mx-0 mt-0.5 mb-0 truncate text-ui text-fg-secondary">
                    {project.artist} • {project.album}
                  </p>
                </div>

                {/* Status Badge */}
                <div>
                  {project.status === 'ready' ? (
                    <span
                      className="rounded-lg border border-emerald-400/30 bg-emerald-400/15 px-2 py-1 text-xxs font-bold text-emerald-400"
                    >
                      {t.stems.statusReady}
                    </span>
                  ) : project.status === 'separating' ? (
                    <span
                      className="flex items-center gap-1 rounded-lg border border-accent-amber/30 bg-accent-amber/15 px-2 py-1 text-xxs font-bold text-accent-amber"
                    >
                      <Sparkles size={10} className="animate-spin" />
                      {fmt(t.stems.statusSeparating, String(Math.round(project.progress * 100)))}
                    </span>
                  ) : project.status === 'failed' ? (
                    <span
                      className="rounded-lg border border-accent-red/30 bg-accent-red/15 px-2 py-1 text-xxs font-bold text-red-400"
                    >
                      {t.stems.statusFailed}
                    </span>
                  ) : (
                    <span
                      className="rounded-lg border border-sky-400/30 bg-sky-400/15 px-2 py-1 text-xxs font-bold text-sky-400"
                    >
                      {t.stems.statusQueued}
                    </span>
                  )}
                </div>
              </div>

              {/* Technical info */}
              <div className="flex items-center gap-3.5 border-t border-white/5 pt-2 text-xs text-fg-muted">
                <span className="flex items-center gap-1">
                  <Layers size={13} /> {fmt(t.stems.tracksCount, String(project.channels.length))}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive size={13} /> {formatBytes(project.disk_size_bytes)}
                </span>
              </div>

              {/* Action buttons */}
              <div className="mt-auto flex items-center justify-between pt-1.5">
                <button
                  onClick={() => onOpenProject(project.id)}
                  className="flex items-center gap-1.5 rounded-lg border-0 bg-linear-135 from-pink-500 to-violet-500 px-4 py-2 text-ui font-bold text-fg"
                >
                  <Play size={14} fill="#ffffff" />
                  {t.stems.openStudio}
                </button>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleStartRename(project)}
                    title={t.stems.renameProject}
                    className="rounded-md border-0 bg-transparent p-1.5 text-fg-secondary"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id, project.title)}
                    title={t.stems.deleteProject}
                    className="rounded-md border-0 bg-transparent p-1.5 text-accent-red"
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
