import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/dialogue_segments.dart';

/// Renders scene prose with narration and direct speech clearly separated:
/// narration is organized paragraph by paragraph (بند به بند) with distinct
/// paragraph margins separate from line height, while dialogue gets an accent
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

  TextStyle _narrativeStyle({bool isLead = false}) {
    return isPersian
        ? GoogleFonts.vazirmatn(
            fontSize: fontSize,
            height: lineHeight,
            color: isLead ? const Color(0xFFF4F4F5) : const Color(0xFFE4E4E7),
            fontWeight: isLead ? FontWeight.w500 : FontWeight.w400,
          )
        : GoogleFonts.merriweather(
            fontSize: fontSize + 1,
            height: lineHeight,
            color: isLead ? const Color(0xFFF4F4F5) : const Color(0xFFE4E4E7),
            fontWeight: isLead ? FontWeight.w500 : FontWeight.w400,
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
    var globalParagraphIndex = 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final seg in segments)
          if (seg.type == ProseSegmentType.dialogue)
            Container(
              margin: const EdgeInsets.only(bottom: 18),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                '${isPersian ? '« ' : '"'}${seg.text}${isPersian ? ' »' : '"'}',
                style: _dialogueStyle(),
              ),
            )
          else
            for (final paragraph in splitParagraphs(seg.text))
              Builder(
                builder: (context) {
                  final isLead = globalParagraphIndex == 0;
                  globalParagraphIndex++;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: Text(
                      paragraph,
                      style: _narrativeStyle(isLead: isLead),
                      textAlign: isPersian ? TextAlign.justify : TextAlign.start,
                    ),
                  );
                },
              ),
      ],
    );
  }
}
