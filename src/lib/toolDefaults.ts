import type { EditorTool, Rgba, ToolConfig } from '../types/model';

export const DEFAULT_INK: Rgba = [0, 230, 118, 255];

export const BASE_CONFIG: ToolConfig = {
  base_width: 3,
  pressure_enabled: true,
  pressure_min_factor: 0.35,
  direction_strength: 0,
  rgba: DEFAULT_INK,
  speed_strength: 0,
  taper_enabled: false,
  taper_min_factor: 0,
  neon: false,
  neon_strength: 0.6,
  dash_length: 10,
  dash_gap: 8,
  highlighter_alpha: 0.35,
};

/** Exact mirror of Nnotes `ToolDefaults.configFor`. */
export function defaultToolConfig(tool: EditorTool): ToolConfig {
  switch (tool) {
    case 'pen': return { ...BASE_CONFIG, base_width: 3, pressure_enabled: true, pressure_min_factor: 0.35 };
    case 'pencil': return { ...BASE_CONFIG, base_width: 2, pressure_min_factor: 0.25 };
    case 'dashed': return { ...BASE_CONFIG, base_width: 3, pressure_enabled: false, pressure_min_factor: 1, dash_length: 10, dash_gap: 8 };
    case 'calligraphy': return { ...BASE_CONFIG, base_width: 6, pressure_min_factor: 0.4, direction_strength: 0.6 };
    case 'speed': return { ...BASE_CONFIG, base_width: 4, pressure_min_factor: 0.35, speed_strength: 0.8 };
    case 'taper': return { ...BASE_CONFIG, base_width: 4, pressure_min_factor: 0.45, taper_enabled: true, taper_min_factor: 0.3 };
    case 'highlighter': return { ...BASE_CONFIG, base_width: 16, pressure_enabled: false, pressure_min_factor: 1, highlighter_alpha: 0.5 };
    case 'eraser': return { ...BASE_CONFIG, base_width: 10, pressure_enabled: false, pressure_min_factor: 1, erase_mode: 'area' };
    case 'lasso': return { ...BASE_CONFIG, base_width: 2, pressure_enabled: false, pressure_min_factor: 1 };
    case 'tape': return { ...BASE_CONFIG, base_width: 32, pressure_enabled: false, pressure_min_factor: 1 };
    default: return { ...BASE_CONFIG };
  }
}

/** Exact mirror of Nnotes `ToolConversions.widthRange`. */
export function widthRange(tool: EditorTool): [number, number] {
  if (tool === 'pencil') return [0.5, 16];
  if (tool === 'highlighter') return [4, 40];
  if (tool === 'eraser') return [1, 80];
  return [1, 20];
}

export function normalizeConfig(raw: Partial<ToolConfig> | undefined, tool: EditorTool): ToolConfig {
  const base = defaultToolConfig(tool);
  if (!raw) return base;
  return { ...base, ...raw, rgba: raw.rgba ?? base.rgba };
}
