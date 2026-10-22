import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../models/game_state.dart';
import '../../services/game_api_service.dart';
import 'full_screen_image_viewer.dart';

/// An atmospheric RPG portrait card shown when an NPC appears for the
/// first time: image-only portrait framed in a stylish container with
/// expanded height, with no text overlays or descriptions.
class NpcDiscoveryCard extends StatelessWidget {
  final DiscoveredNpc npc;
  final bool isPersian;
  final Color accentColor;
  final VoidCallback? onDismiss;

  const NpcDiscoveryCard({
    super.key,
    required this.npc,
    this.isPersian = true,
    this.accentColor = const Color(0xFFA78BFA),
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final n = npc;
    final rawImage = n.imageUrl?.trim() ?? '';
    // Local dev uploads come back as relative paths (/uploads/...); resolve
    // them against the active backend so emulator/dev builds load them.
    final resolvedImage = rawImage.startsWith('/') ? '${GameApiService.baseUrl}$rawImage' : rawImage;
    final hasImage = resolvedImage.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF0F111D).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accentColor.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.12),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.6),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: hasImage
          ? Stack(
              children: [
                GestureDetector(
                  onTap: () => FullScreenImageViewer.show(context, resolvedImage),
                  child: CachedNetworkImage(
                    imageUrl: resolvedImage,
                    height: 440,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                    placeholder: (context, url) => Container(
                      height: 440,
                      color: const Color(0xFF0F111D),
                      child: const Center(
                        child: SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFFA78BFA),
                          ),
                        ),
                      ),
                    ),
                    errorWidget: (context, url, error) => Container(
                      height: 320,
                      color: const Color(0xFF0F111D),
                      child: const Center(
                        child: Icon(
                          Icons.person_rounded,
                          color: Color(0xFFA78BFA),
                          size: 48,
                        ),
                      ),
                    ),
                  ),
                ),

                // Top-left zoom icon indicator
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.zoom_in_rounded,
                      color: Colors.white70,
                      size: 16,
                    ),
                  ),
                ),

                // Top-right dismiss button
                if (onDismiss != null)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: InkWell(
                      onTap: onDismiss,
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 16,
                          color: Colors.white70,
                        ),
                      ),
                    ),
                  ),
              ],
            )
          : Container(
              height: 240,
              color: const Color(0xFF0F111D),
              child: Stack(
                children: [
                  const Center(
                    child: Icon(
                      Icons.person_rounded,
                      color: Color(0xFFA78BFA),
                      size: 64,
                    ),
                  ),
                  if (onDismiss != null)
                    Positioned(
                      top: 10,
                      right: 10,
                      child: InkWell(
                        onTap: onDismiss,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            size: 16,
                            color: Colors.white70,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.06, end: 0, curve: Curves.easeOutCubic);
  }
}
