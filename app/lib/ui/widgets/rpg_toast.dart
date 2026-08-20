import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum RpgToastType { success, warning, info, error }

class RpgToast {
  static OverlayEntry? _currentEntry;

  static void show(
    BuildContext context, {
    required String title,
    String? subtitle,
    RpgToastType type = RpgToastType.success,
    bool isPersian = true,
    Duration duration = const Duration(milliseconds: 3200),
  }) {
    // Dismiss existing toast if still active
    _currentEntry?.remove();
    _currentEntry = null;

    final overlayState = Overlay.of(context, rootOverlay: true);

    Color accentColor;
    IconData iconData;

    switch (type) {
      case RpgToastType.success:
        accentColor = const Color(0xFF10B981); // Emerald
        iconData = Icons.favorite_rounded;
        break;
      case RpgToastType.warning:
        accentColor = const Color(0xFFF59E0B); // Amber
        iconData = Icons.shield_rounded;
        break;
      case RpgToastType.info:
        accentColor = const Color(0xFF6366F1); // Indigo
        iconData = Icons.flash_on_rounded;
        break;
      case RpgToastType.error:
        accentColor = const Color(0xFFEF4444); // Crimson
        iconData = Icons.warning_amber_rounded;
        break;
    }

    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (ctx) => _RpgToastWidget(
        title: title,
        subtitle: subtitle,
        accentColor: accentColor,
        iconData: iconData,
        isPersian: isPersian,
        duration: duration,
        onDismiss: () {
          if (_currentEntry == entry) {
            entry.remove();
            _currentEntry = null;
          }
        },
      ),
    );

    _currentEntry = entry;
    overlayState.insert(entry);
  }
}

class _RpgToastWidget extends StatefulWidget {
  final String title;
  final String? subtitle;
  final Color accentColor;
  final IconData iconData;
  final bool isPersian;
  final Duration duration;
  final VoidCallback onDismiss;

  const _RpgToastWidget({
    required this.title,
    this.subtitle,
    required this.accentColor,
    required this.iconData,
    required this.isPersian,
    required this.duration,
    required this.onDismiss,
  });

  @override
  State<_RpgToastWidget> createState() => _RpgToastWidgetState();
}

class _RpgToastWidgetState extends State<_RpgToastWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -0.4),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));

    _controller.forward();

    Future.delayed(widget.duration, () {
      if (mounted) {
        _controller.reverse().then((_) {
          if (mounted) {
            widget.onDismiss();
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDismiss() {
    _controller.reverse().then((_) {
      if (mounted) {
        widget.onDismiss();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top + 12;

    return Positioned(
      top: topPadding,
      left: 16,
      right: 16,
      child: Material(
        color: Colors.transparent,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: GestureDetector(
              onTap: _handleDismiss,
              child: Directionality(
                textDirection:
                    widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F111D).withValues(alpha: 0.96),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: widget.accentColor.withValues(alpha: 0.6),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: widget.accentColor.withValues(alpha: 0.3),
                        blurRadius: 20,
                        spreadRadius: 2,
                        offset: const Offset(0, 4),
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.7),
                        blurRadius: 15,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      // Glowing Icon
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: widget.accentColor.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: widget.accentColor.withValues(alpha: 0.5),
                          ),
                        ),
                        child: Icon(
                          widget.iconData,
                          color: widget.accentColor,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Text Content
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.title,
                              style: widget.isPersian
                                  ? GoogleFonts.vazirmatn(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    )
                                  : GoogleFonts.cinzel(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                            ),
                            if (widget.subtitle != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                widget.subtitle!,
                                style: GoogleFonts.vazirmatn(
                                  fontSize: 12,
                                  color: Colors.white70,
                                  height: 1.3,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),

                      // Close icon button
                      const SizedBox(width: 8),
                      Icon(
                        Icons.close_rounded,
                        size: 16,
                        color: Colors.white30,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
