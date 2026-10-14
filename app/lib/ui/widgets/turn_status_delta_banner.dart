import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/realm_theme.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/turn_status_delta.dart';

/// An illuminated RPG status delta banner displayed as a floating notification
/// or inline card. Visually highlights health, resource, currency, inventory,
/// and progression updates that occurred as a result of the player's previous action.
class TurnStatusDeltaBanner extends StatefulWidget {
  final TurnStatusDelta delta;
  final RealmTheme theme;
  final bool isPersian;
  final VoidCallback? onOpenCompendium;
  final VoidCallback? onDismiss;
  final Duration? autoDismissDuration;
  final bool isFloating;

  const TurnStatusDeltaBanner({
    super.key,
    required this.delta,
    required this.theme,
    this.isPersian = true,
    this.onOpenCompendium,
    this.onDismiss,
    this.autoDismissDuration,
    this.isFloating = false,
  });

  @override
  State<TurnStatusDeltaBanner> createState() => _TurnStatusDeltaBannerState();
}

class _TurnStatusDeltaBannerState extends State<TurnStatusDeltaBanner> {
  Timer? _dismissTimer;
  bool _isDismissed = false;

  @override
  void initState() {
    super.initState();
    _startDismissTimer();
  }

  @override
  void didUpdateWidget(TurnStatusDeltaBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.delta != widget.delta) {
      _isDismissed = false;
      _startDismissTimer();
    }
  }

  void _startDismissTimer() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    if (widget.autoDismissDuration != null && widget.delta.hasChanges && !_isDismissed) {
      _dismissTimer = Timer(widget.autoDismissDuration!, () {
        if (mounted) {
          setState(() => _isDismissed = true);
          widget.onDismiss?.call();
        }
      });
    }
  }

  void _handleDismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    if (mounted) {
      setState(() => _isDismissed = true);
      widget.onDismiss?.call();
    }
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isDismissed || !widget.delta.hasChanges) {
      return const SizedBox.shrink();
    }

    final isFa = widget.isPersian;
    final items = widget.delta.items;

    // Determine the primary tint based on the most impactful change:
    // Health loss is highest priority (crimson), then level-up (gold),
    // healing (emerald), currency (amber), item (purple), else realm primary.
    Color primaryTint = widget.theme.primaryAccent;
    if (items.any((i) => i.type == StatusDeltaType.healthLoss)) {
      primaryTint = const Color(0xFFEF4444);
    } else if (items.any((i) => i.type == StatusDeltaType.levelUp)) {
      primaryTint = const Color(0xFFF59E0B);
    } else if (items.any((i) => i.type == StatusDeltaType.healthGain)) {
      primaryTint = const Color(0xFF10B981);
    } else if (items.any((i) => i.type == StatusDeltaType.currencyGain || i.type == StatusDeltaType.currencyLoss)) {
      primaryTint = const Color(0xFFF59E0B);
    } else if (items.any((i) => i.type == StatusDeltaType.itemAcquired)) {
      primaryTint = const Color(0xFFA855F7);
    }

    final container = Container(
      margin: widget.isFloating ? EdgeInsets.zero : const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0F1B).withValues(alpha: widget.isFloating ? 0.96 : 0.94),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: primaryTint.withValues(alpha: widget.isFloating ? 0.45 : 0.38),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: primaryTint.withValues(alpha: widget.isFloating ? 0.20 : 0.12),
            blurRadius: widget.isFloating ? 24 : 18,
            offset: const Offset(0, 3),
          ),
          BoxShadow(
            color: Colors.black.withValues(alpha: widget.isFloating ? 0.70 : 0.5),
            blurRadius: widget.isFloating ? 16 : 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Top Ribbon Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
            decoration: BoxDecoration(
              color: primaryTint.withValues(alpha: 0.10),
              border: Border(
                bottom: BorderSide(
                  color: primaryTint.withValues(alpha: 0.18),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Title and Icon
                Expanded(
                  child: Row(
                    children: [
                      Icon(
                        Icons.insights_rounded,
                        size: 15,
                        color: primaryTint,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          isFa ? 'پیامدهای نوبت و تغییرات وضعیت' : 'SCENE CONSEQUENCES & UPDATES',
                          style: isFa
                              ? GoogleFonts.vazirmatn(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: primaryTint,
                                )
                              : GoogleFonts.inter(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.1,
                                  color: primaryTint,
                                ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),

                // Codex Action Link & Close Button
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.onOpenCompendium != null) ...[
                      InkWell(
                        onTap: widget.onOpenCompendium,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                          decoration: BoxDecoration(
                            color: widget.theme.primaryAccent.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: widget.theme.primaryAccent.withValues(alpha: 0.32),
                              width: 0.8,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.auto_stories_rounded,
                                size: 12,
                                color: widget.theme.primaryAccent,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                isFa ? 'طومار' : 'Codex',
                                style: isFa
                                    ? GoogleFonts.vazirmatn(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFFF1F5F9),
                                      )
                                    : GoogleFonts.inter(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFFF1F5F9),
                                      ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    InkWell(
                      onTap: _handleDismiss,
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: const EdgeInsets.all(3),
                        child: Icon(
                          Icons.close_rounded,
                          size: 15,
                          color: const Color(0xFF94A3B8).withValues(alpha: 0.7),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Body: Delta Chips
          Padding(
            padding: const EdgeInsets.all(11),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: items.map((item) => _buildDeltaChip(item, isFa)).toList(),
            ),
          ),
        ],
      ),
    );

    if (widget.isFloating) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: GestureDetector(
            onVerticalDragEnd: (details) {
              if (details.primaryVelocity != null && details.primaryVelocity! > 180) {
                _handleDismiss();
              }
            },
            child: container,
          ),
        ),
      )
          .animate()
          .fadeIn(duration: 300.ms)
          .slideY(begin: 0.18, end: 0, duration: 350.ms, curve: Curves.easeOutCubic);
    }

    return container
        .animate()
        .fadeIn(duration: 350.ms)
        .slideY(begin: -0.05, end: 0, duration: 350.ms, curve: Curves.easeOutCubic);
  }

  Widget _buildDeltaChip(StatusDeltaItem item, bool isFa) {
    final hasDelta = item.delta != null && item.delta != 0;
    final deltaSign = (item.delta != null && item.delta! > 0) ? '+' : '';
    final deltaStr = hasDelta ? '$deltaSign${item.delta}' : '';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6.5),
      decoration: BoxDecoration(
        color: const Color(0xFF131627).withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: item.color.withValues(alpha: 0.28),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: item.color.withValues(alpha: 0.08),
            blurRadius: 6,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            item.icon,
            size: 14.5,
            color: item.color,
          ),
          const SizedBox(width: 6),

          // Signed Delta Value (Strictly wrapped in LTR container per RTL rule)
          if (hasDelta) ...[
            Directionality(
              textDirection: TextDirection.ltr,
              child: Text(
                deltaStr.toPersianDigits(enable: isFa),
                style: GoogleFonts.inter(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: item.color,
                ),
              ),
            ),
            const SizedBox(width: 5),
          ],

          // Label
          Text(
            item.label,
            style: isFa
                ? GoogleFonts.vazirmatn(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFF1F5F9),
                  )
                : GoogleFonts.inter(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFFF1F5F9),
                  ),
          ),

          // Subtitle / Current Stat (e.g., "(12 / 20)" or "(دریافت شد)")
          if (item.subtitle != null && item.subtitle!.isNotEmpty) ...[
            const SizedBox(width: 5),
            _buildSubtitle(item.subtitle!, item.color, isFa),
          ],
        ],
      ),
    );
  }

  Widget _buildSubtitle(String subtitle, Color itemColor, bool isFa) {
    // If subtitle contains numbers, slash, or math symbols (e.g., '12 / 20', '85'),
    // wrap in LTR container to prevent RTL BiDi transposition bugs.
    final hasNumbersOrSlash = RegExp(r'[0-9/]').hasMatch(subtitle);

    if (hasNumbersOrSlash) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            subtitle.toPersianDigits(enable: isFa),
            style: GoogleFonts.inter(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF94A3B8),
            ),
          ),
        ),
      );
    }

    return Text(
      '($subtitle)',
      style: isFa
          ? GoogleFonts.vazirmatn(
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
              color: itemColor.withValues(alpha: 0.85),
            )
          : GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: itemColor.withValues(alpha: 0.85),
            ),
    );
  }
}
