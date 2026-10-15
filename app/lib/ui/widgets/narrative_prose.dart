import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/dialogue_segments.dart';

/// A discovery card (NPC introduction, creature encounter, ...) to be
/// interleaved with the prose: it renders directly below the first paragraph
/// or dialogue block that mentions one of [matchNames. Cards whose names never
/// appear fall back to the bottom of the scene.
class ProseSpotlight {
  final List<String> matchNames;
  final Widget card;

  const ProseSpotlight({
    required this.matchNames,
    required this.card,
  });
}

String _normalizeSpot(String s) {
  return s
      .replaceAll(RegExp(r'[‌‍‎‏­]'), ' ')
      .replaceAll(RegExp(r'[ً-ٰٟ]'), '')
      .replaceAll(RegExp(r'[«»""“”`’‘]'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim()
      .toLowerCase();
}

class _PendingSpot {
  final ProseSpotlight spot;
  final List<String> names;
  bool placed = false;

  _PendingSpot(this.spot)
      : names = spot.matchNames.map(_normalizeSpot).where((n) => n.isNotEmpty).toList();
}

/// Renders scene prose with narration and direct speech clearly separated:
/// narration is organized paragraph by paragraph (بند به بند) with distinct
/// paragraph margins separate from line height, while dialogue gets an accent
/// side-bar, tinted backdrop, and an italic voice.
///
/// Discovery [spotlights] are inserted right after the paragraph that
/// introduces them; unmatched ones render at the bottom.
class NarrativeProse extends StatelessWidget {
  final String text;
  final bool isPersian;
  final double fontSize;
  final double lineHeight;
  final Color accentColor;
  final List<ProseSpotlight> spotlights;

  const NarrativeProse({
    super.key,
    required this.text,
    this.isPersian = true,
    this.fontSize = 16.0,
    this.lineHeight = 1.95,
    this.accentColor = const Color(0xFFF59E0B),
    this.spotlights = const [],
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
    final pending = spotlights.map(_PendingSpot.new).toList();
    var globalParagraphIndex = 0;

    Widget takeSpotlight(String blockText) {
      if (pending.every((p) => p.placed)) return const SizedBox.shrink();
      final norm = _normalizeSpot(blockText);
      if (norm.isEmpty) return const SizedBox.shrink();
      for (final p in pending) {
        if (!p.placed && p.names.any((nm) => norm.contains(nm))) {
          p.placed = true;
          return p.spot.card;
        }
      }
      return const SizedBox.shrink();
    }

    Widget dialogueBlock(ProseSegment seg) {
      final card = takeSpotlight(seg.text);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
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
          ),
          card,
        ],
      );
    }

    Widget paragraphBlock(String paragraph) {
      final isLead = globalParagraphIndex == 0;
      globalParagraphIndex++;
      final card = takeSpotlight(paragraph);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Text(
              paragraph,
              style: _narrativeStyle(isLead: isLead),
              textAlign: isPersian ? TextAlign.justify : TextAlign.start,
            ),
          ),
          card,
        ],
      );
    }

    final children = <Widget>[];
    for (final seg in segments) {
      if (seg.type == ProseSegmentType.dialogue) {
        children.add(dialogueBlock(seg));
      } else {
        for (final paragraph in splitParagraphs(seg.text)) {
          children.add(paragraphBlock(paragraph));
        }
      }
    }
    // Spotlights never mentioned in the prose fall back to the bottom.
    for (final p in pending) {
      if (!p.placed) children.add(p.spot.card);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }
}
