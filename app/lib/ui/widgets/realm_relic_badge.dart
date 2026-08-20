import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/realm_theme.dart';

class RealmRelicBadge extends StatefulWidget {
  final RealmTheme theme;
  final VoidCallback onTap;

  const RealmRelicBadge({
    super.key,
    required this.theme,
    required this.onTap,
  });

  @override
  State<RealmRelicBadge> createState() => _RealmRelicBadgeState();
}

class _RealmRelicBadgeState extends State<RealmRelicBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      child: Container(
        width: 42,
        height: 42,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final angle = _controller.value * 2 * pi;
            final pulse = (sin(_controller.value * 4 * pi) + 1.0) * 0.5;

            return Stack(
              alignment: Alignment.center,
              children: [
                // 1. Ambient Breathing Glow
                Container(
                  width: 32 + pulse * 6,
                  height: 32 + pulse * 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: widget.theme.primaryAccent.withValues(alpha: 0.15 + pulse * 0.15),
                    boxShadow: [
                      BoxShadow(
                        color: widget.theme.primaryAccent.withValues(alpha: 0.3 + pulse * 0.2),
                        blurRadius: 12 + pulse * 4,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),

                // 2. Rotating Outer Rune Ring
                Transform.rotate(
                  angle: angle,
                  child: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: widget.theme.primaryAccent.withValues(alpha: 0.6),
                        width: 1.2,
                      ),
                    ),
                    child: Stack(
                      children: [
                        Positioned(
                          top: 0,
                          left: 14,
                          child: Container(
                            width: 4,
                            height: 4,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: widget.theme.primaryAccent,
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 14,
                          child: Container(
                            width: 4,
                            height: 4,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: widget.theme.primaryAccent,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 3. Counter-Rotating Inner Gyroscope Diamond
                Transform.rotate(
                  angle: -angle * 1.5,
                  child: Transform(
                    transform: Matrix4.identity()
                      ..setEntry(3, 2, 0.002)
                      ..rotateY(angle),
                    alignment: Alignment.center,
                    child: Container(
                      width: 18,
                      height: 18,
                      decoration: BoxDecoration(
                        color: widget.theme.cardBg,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: widget.theme.primaryAccent,
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),
                ),

                // 4. Glowing Core
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                    boxShadow: [
                      BoxShadow(
                        color: widget.theme.primaryAccent,
                        blurRadius: 6,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
