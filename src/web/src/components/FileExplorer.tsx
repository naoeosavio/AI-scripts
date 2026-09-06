import React, { useState, useEffect } from 'react';
import { Folder, File, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api.ts';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  selectedFilePath: string | null;
  refreshTrigger: number;
}

export default function FileExplorer({ onFileSelect, selectedFilePath, refreshTrigger }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/status');
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error fetching file structure:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  const toggleExpand = (dirPath: string) => {
    setExpandedDirs((prev) => ({
      ...prev,
      [dirPath]: !prev[dirPath],
    }));
  };

  // Pre-expand top-level folders by default if they are empty
  useEffect(() => {
    if (files.length > 0) {
      const initialExpand: Record<string, boolean> = {};
      files.forEach((file) => {
        if (file.isDirectory && file.name === 'src') {
          initialExpand[file.path] = true;
        }
      });
      setExpandedDirs((prev) => ({ ...initialExpand, ...prev }));
    }
  }, [files]);

  const renderNode = (node: FileNode, depth = 0) => {
    const isExpanded = expandedDirs[node.path];
    const isSelected = selectedFilePath === node.path;

    if (node.isDirectory) {
      return (
        <div key={node.path} className="flex flex-col">
          <button
            onClick={() => toggleExpand(node.path)}
            className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-white/5 text-left text-xs font-bold text-(--color-text-secondary) transition-colors w-full cursor-pointer rounded-none uppercase tracking-wide font-display"
            style={{ paddingLeft: `${depth * 12 + 10}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-(--color-text-muted) shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-(--color-text-muted) shrink-0" />
            )}
            <Folder className="w-3.5 h-3.5 text-(--color-accent) shrink-0 fill-(--color-accent)/10" />
            <span className="truncate">{node.name}</span>
          </button>
          {isExpanded && node.children && (
            <div className="flex flex-col border-l border-(--color-border-subtle) ml-3.5">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <button
          key={node.path}
          onClick={() => onFileSelect(node.path)}
          className={`flex items-center gap-2 py-1.5 px-2.5 text-left text-xs transition-all duration-150 w-full cursor-pointer rounded-none font-mono ${
            isSelected
              ? 'bg-white/5 text-(--color-text-primary) font-bold border-l-2 border-(--color-accent)'
              : 'hover:bg-white/5 text-(--color-text-secondary)'
          }`}
          style={{ paddingLeft: `${depth * 12 + 15}px` }}
        >
          <File className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-(--color-accent)' : 'text-(--color-text-muted)'}`} />
          <span className="truncate">{node.name}</span>
        </button>
      );
    }
  };

  return (
    <div className="flex flex-col h-full bg-(--color-bg-primary) border-r border-(--color-border-subtle)">
      <div className="flex items-center justify-between p-4 border-b border-(--color-border-subtle) bg-(--color-bg-primary)">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-(--color-accent)" />
          <span className="text-[10px] font-display font-black tracking-[0.25em] uppercase text-(--color-text-secondary)">
            Explorer Nodes
          </span>
        </div>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="p-1 rounded-none text-(--color-text-muted) hover:text-(--color-text-primary) hover:bg-white/5 disabled:opacity-50 transition-colors cursor-pointer"
          title="Sync Node Directory"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-(--color-accent)' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5 custom-scrollbar bg-(--color-bg-primary)">
        {files.length === 0 ? (
          <div className="p-4 text-center text-(--color-text-muted) text-xs font-mono uppercase tracking-wider">Empty Directory</div>
        ) : (
          files.map((file) => renderNode(file))
        )}
      </div>
    </div>
  );
}
