import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// Full-screen image viewer with pinch-to-zoom. Open via [show].
class FullScreenImageViewer extends StatelessWidget {
  final String imageUrl;

  const FullScreenImageViewer({
    super.key,
    required this.imageUrl,
  });

  static Future<void> show(BuildContext context, String imageUrl) {
    return showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.92),
      builder: (context) => FullScreenImageViewer(imageUrl: imageUrl),
    );
  }

  @override
  Widget build(BuildContext context) {
    final image = CachedNetworkImage(
      imageUrl: imageUrl,
      fit: BoxFit.contain,
      placeholder: (context, url) => const Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF59E0B)),
        ),
      ),
      errorWidget: (context, url, error) => const Center(
        child: Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
      ),
    );

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: EdgeInsets.zero,
      child: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 4.0,
                child: Center(child: image),
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 8,
            child: IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.close_rounded, color: Colors.white, size: 26),
              style: IconButton.styleFrom(
                backgroundColor: Colors.black.withValues(alpha: 0.55),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
