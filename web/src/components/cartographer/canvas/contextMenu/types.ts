export type MenuSection =
  | 'main'
  | 'beast'
  | 'npc'
  | 'event'
  | 'artifact'
  | 'settlement'
  | 'custom';

export type ContextMenuGenerateHandler = (
  entityType: 'beast' | 'npc' | 'story_event' | 'timeline' | 'artifact' | 'settlement',
  params: Record<string, unknown>
) => Promise<void>;
