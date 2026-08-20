---
name: flutter-architect
description: Master Flutter 3.47+ clean architecture, Riverpod state management, reader-first typography, and rich animations. Use PROACTIVELY when building or enhancing Flutter components for StoryForge.
---

# Flutter Architecture & Best Practices for StoryForge

This skill guides the design and implementation of the **StoryForge Flutter Reader Client** with clean architecture, robust state management, and reader-first UX.

## 1. Core Architecture (Feature-First)

Organize features cleanly:
```
lib/
├── core/
│   ├── theme/          # Book themes (Light, Sepia, Charcoal, OLED Dark)
│   ├── typography/     # Vazirmatn, Shabnam (Fa) / Merriweather, Inter (En)
│   ├── network/        # SSE (Server-Sent Events) streaming client & Dio/Http
│   └── audio_haptics/  # Subtle page-turn and dice-roll feedback
└── features/
    ├── library/        # Story catalog, genre chips, cover cards
    ├── reader/         # Text viewport, pagination, smooth chunk fade-ins
    ├── rpg_hud/        # Slide-over character drawer, health/stamina bars, inventory
    ├── choices/        # 3-tier risk pills, free-text action box, dice roll visualizer
    └── session/        # Playthrough session state & local cache
```

## 2. State Management (Riverpod)
- Use `@riverpod` code generation / `Notifier` / `AsyncNotifier`.
- Keep business logic inside Notifiers; UI widgets must remain purely declarative.
- For streaming narrative prose, use `StreamNotifier` or `AsyncNotifier` consuming the backend SSE stream.

## 3. Reader Typography & UX Principles
- **No Chat Bubble Visuals**: Content must look like an editorial book or publication.
- **Bilingual Bidirectional Support**: Seamless RTL (Persian) and LTR (English) text directionality based on the story manifest.
- **Customizable Reading Preferences**:
  - Font family selector
  - Font size (14sp to 26sp)
  - Line height multiplier (1.4 to 2.2)
  - Horizontal margin / padding controls
- **Discreet RPG HUD**:
  - Keep stats in a collapsible bottom sheet or floating status pill.
  - Never let RPG stats obstruct the reading line.

## 4. Choice & Action Interface
- **Risk Indicators**: Clear visual distinctions (🛡 Low / 🤸 Medium / ⚔️ High).
- **Free-Text Actions**: Real-time validation status indicator (checking against inventory/lore).
- **Dice Roll Visuals**: Subtle, smooth 2D/3D roll animation with haptic feedback on critical checks.

## 5. Modern Dart & Widget Construction Idioms

### Null-Aware Collection Elements (Dart 3.8+)
When building widget trees with optional/nullable children in `Column`, `Row`, or `Stack`, use null-aware collection elements (`?element`) instead of pattern-matching or explicit null checks:

```dart
// ✅ Recommended (Clean, idiomatic Dart 3.8+)
Stack(
  children: [
    _buildBackground(),
    if (showOverlay) _buildOverlay(),
    ?overlayChild, // Automatically omitted if null; non-null if present
  ],
)

// ❌ Avoid (Triggers 'use_null_aware_elements' lint)
Stack(
  children: [
    _buildBackground(),
    if (overlayChild case final child?) child,
    if (overlayChild != null) overlayChild!,
  ],
)
```

