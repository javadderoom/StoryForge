import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/dialogue_segments.dart';

/// Renders scene prose with narration and direct speech clearly separated:
/// narration keeps the classic reader style, dialogue gets an accent
/// side-bar, tinted backdrop, and an italic voice.
class NarrativeProse extends StatelessWidget {
  final String text;
  final bool isPersian;
  final double fontSize;
  final double lineHeight;
  final Color accentColor;

  const NarrativeProse({
    super.key,
    required this.text,
    this.isPersian = true,
    this.fontSize = 16.0,
    this.lineHeight = 1.95,
    this.accentColor = const Color(0xFFF59E0B),
  });

  TextStyle _narrativeStyle() {
    return isPersian
        ? GoogleFonts.vazirmatn(
            fontSize: fontSize,
            height: lineHeight,
            color: const Color(0xFFE4E4E7),
            fontWeight: FontWeight.w400,
          )
        : GoogleFonts.merriweather(
            fontSize: fontSize + 1,
            height: lineHeight,
            color: const Color(0xFFE4E4E7),
            letterSpacing: 0.2,
          );
  }

  TextStyle _dialogueStyle() {
    final base = _narrativeStyle();
    return base.copyWith(
      fontStyle: FontStyle.italic,
      color: const Color(0xFFFDE68A),
    );
  }

  @override
  Widget build(BuildContext context) {
    final segments = segmentProse(text);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final seg in segments)
          if (seg.type == ProseSegmentType.dialogue)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border(
                  right: isPersian
                      ? BorderSide(color: accentColor, width: 3)
                      : BorderSide.none,
                  left: isPersian
                      ? BorderSide.none
                      : BorderSide(color: accentColor, width: 3),
                ),
              ),
              child: Text(
                '${isPersian ? '❝ ' : '"'}${seg.text}',
                style: _dialogueStyle(),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Text(seg.text, style: _narrativeStyle()),
            ),
      ],
    );
  }
}
