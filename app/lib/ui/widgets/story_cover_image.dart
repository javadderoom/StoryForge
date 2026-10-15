import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/game_api_service.dart';

class StoryCoverImage extends StatelessWidget {
  final String storyId;
  final String? coverImageUrl;
  final double? height;
  final double? width;
  final BorderRadius? borderRadius;
  final BoxFit fit;
  final bool showGradientOverlay;
  final List<Color>? gradientColors;
  final Widget? overlayChild;
  final String? heroTag;

  const StoryCoverImage({
    super.key,
    required this.storyId,
    this.coverImageUrl,
    this.height,
    this.width,
    this.borderRadius,
    this.fit = BoxFit.cover,
    this.showGradientOverlay = true,
    this.gradientColors,
    this.overlayChild,
    this.heroTag,
  });

  String? _trimmedUrl() {
    final t = coverImageUrl?.trim();
    if (t == null || t.isEmpty) return null;
    return t;
  }

  /// Returns an absolute https(http) URL, or null when there is no usable remote image.
  /// Handles Vercel Blob https URLs plus legacy relative paths (/uploads/..., /covers/...)
  /// by prefixing the current backend baseUrl.
  String? _resolveNetworkUrl() {
    final t = _trimmedUrl();
    if (t == null) return null;
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    if (t.startsWith('//')) return 'https:$t';
    if (t.startsWith('/')) return '${GameApiService.baseUrl}$t';
    return null;
  }

  String _resolveLocalAsset() {
    final t = _trimmedUrl();
    // Only real bundled assets (assets/...) load via Image.asset.
    // Anything else (empty, relative web path) uses splash.
    if (t != null && t.startsWith('assets/')) {
      return t;
    }
    return 'assets/images/splash_art.jpg';
  }

  Widget _buildImageContent() {
    final networkUrl = _resolveNetworkUrl();

    if (networkUrl != null) {
      return CachedNetworkImage(
        imageUrl: networkUrl,
        fit: fit,
        width: width ?? double.infinity,
        height: height,
        placeholder: (context, url) => _buildLoadingPlaceholder(),
        errorWidget: (context, url, error) {
          debugPrint('[StoryCoverImage] failed: $networkUrl -> $error');
          return _buildAssetFallback();
        },
      );
    }

    return _buildAssetFallback();
  }

  Widget _buildAssetFallback() {
    final assetPath = _resolveLocalAsset();
    return Image.asset(
      assetPath,
      fit: fit,
      width: width ?? double.infinity,
      height: height,
      errorBuilder: (context, error, stackTrace) => _buildFallbackPlaceholder(),
    );
  }

  Widget _buildLoadingPlaceholder() {
    return Container(
      width: width ?? double.infinity,
      height: height,
      color: const Color(0xFF0F111D),
      child: const Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: Color(0xFFF59E0B),
          ),
        ),
      ),
    );
  }

  Widget _buildFallbackPlaceholder() {
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1E1B18), Color(0xFF0D0E15)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Center(
        child: Icon(
          Icons.castle_rounded,
          color: Color(0xFFF59E0B),
          size: 40,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final defaultGradient = [
      Colors.transparent,
      const Color(0x66090A10),
      const Color(0xFF121422),
    ];

    Widget content = ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.zero,
      child: SizedBox(
        width: width ?? double.infinity,
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _buildImageContent(),
            if (showGradientOverlay)
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: gradientColors ?? defaultGradient,
                    stops: const [0.0, 0.6, 1.0],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ?overlayChild,
          ],
        ),
      ),
    );

    if (heroTag != null && heroTag!.isNotEmpty) {
      return Hero(
        tag: heroTag!,
        child: content,
      );
    }

    return content;
  }
}
