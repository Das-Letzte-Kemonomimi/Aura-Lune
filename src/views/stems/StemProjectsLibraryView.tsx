import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Play,
  Trash2,
  Edit3,
  HardDrive,
  Sparkles,
} from '../../components/ui/icons';
import { invoke } from '../../api/ipc';
import type { StemProject, StemProjectProgressPayload } from '../../types/analysis';
import { formatBytes } from '../../utils/fileSizeFormat';
import { getTranslations, type Language } from '../../i18n';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { fmt } from '../../utils/fmt';
import { Badge, Button, Callout, Card, EmptyState, IconButton, PageHeader, Spinner, TextField } from '../../components/ui';

interface StemProjectsLibraryViewProps {
  onOpenProject: (projectId: number) => void;
  onOpenCreateProject?: () => void;
  currentLang: Language;
}

export const StemProjectsLibraryView: React.FC<StemProjectsLibraryViewProps> = ({
  onOpenProject,
  onOpenCreateProject,
  currentLang,
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
          ? { ...p, status: payload.status, progress: payload.progress }
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

  const statusBadge = (project: StemProject) => {
    switch (project.status) {
      case 'ready':
        return <Badge tone="green" className="font-bold">{t.stems.statusReady}</Badge>;
      case 'separating':
        return (
          <Badge tone="amber" className="font-bold">
            <Sparkles size={10} className="motion-safe:animate-spin" />
            {fmt(t.stems.statusSeparating, String(Math.round(project.progress * 100)))}
          </Badge>
        );
      case 'failed':
        return <Badge tone="red" className="font-bold">{t.stems.statusFailed}</Badge>;
      default:
        return <Badge tone="cyan" className="font-bold">{t.stems.statusQueued}</Badge>;
    }
  };

  return (
    <div className="w-full px-0 py-6">
      {/* Library section header */}
      <PageHeader
        className="mb-5"
        icon={<Layers size={20} />}
        title={t.stems.title}
        description={t.stems.subtitle}
        actions={
          onOpenCreateProject && (
            <Button variant="primary" onClick={onOpenCreateProject}>
              <Layers size={16} />
              {t.stems.newProject}
            </Button>
          )
        }
      />

      {error && (
        <Callout tone="red" className="mb-4">
          {error}
        </Callout>
      )}

      {loading && projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-15 text-fg-secondary">
          <Spinner size="lg" />
          <div>{t.stems.loadingProjects}</div>
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState icon={<Layers size={22} />} title={t.stems.noProjects} description={t.stems.noProjectsDesc} />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))] gap-4">
          {projects.map((project) => (
            <Card key={project.id} padding="sm" className="flex flex-col gap-3 rounded-2xl">
              {/* Title and status */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  {editingProjectId === project.id ? (
                    <div className="flex gap-1.5">
                      <TextField
                        aria-label={t.stems.renameProject}
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(project.id);
                          if (e.key === 'Escape') setEditingProjectId(null);
                        }}
                        className="flex-1"
                        autoFocus
                      />
                      <Button variant="primary" size="sm" onClick={() => handleSaveRename(project.id)}>
                        {t.common.save}
                      </Button>
                    </div>
                  ) : (
                    <h3 className="truncate text-base font-extrabold text-fg" title={project.title}>
                      <button type="button" onClick={() => onOpenProject(project.id)} className="max-w-full truncate text-left">
                        {project.title}
                      </button>
                    </h3>
                  )}

                  <p className="mt-0.5 truncate text-ui text-fg-secondary">
                    {project.artist} • {project.album}
                  </p>
                </div>

                {statusBadge(project)}
              </div>

              {/* Technical info */}
              <div className="flex items-center gap-3.5 border-t border-line pt-2 text-xs text-fg-muted">
                <span className="flex items-center gap-1">
                  <Layers size={13} /> {fmt(t.stems.tracksCount, String(project.channels.length))}
                </span>
                <span className="flex items-center gap-1">
                  <HardDrive size={13} /> {formatBytes(project.disk_size_bytes)}
                </span>
              </div>

              {/* Action buttons */}
              <div className="mt-auto flex items-center justify-between pt-1.5">
                <Button variant="primary" onClick={() => onOpenProject(project.id)}>
                  <Play size={14} fill="currentColor" />
                  {t.stems.openStudio}
                </Button>

                <div className="flex gap-1">
                  <IconButton size="sm" label={t.stems.renameProject} onClick={() => handleStartRename(project)}>
                    <Edit3 size={15} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={t.stems.deleteProject}
                    onClick={() => handleDelete(project.id, project.title)}
                    className="text-accent-red hover:text-accent-red"
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
