// Splits scene prose into narrative vs dialogue segments.
// Dialogue = text inside quotation marks («», "", “”) or dash-led lines.
// Mirrors web `src/lib/play/dialogueSegments.ts` — keep the two in sync.

enum ProseSegmentType { narrative, dialogue }

class ProseSegment {
  final ProseSegmentType type;
  String text;
  ProseSegment(this.type, this.text);
}

const _closers = <String, String>{
  '«': '»',
  '"': '"',
  '“': '”',
};

final _dashLine = RegExp(r'^\s*(—|–|-)\s+');

List<ProseSegment> segmentProse(String input) {
  final out = <ProseSegment>[];
  void push(ProseSegmentType type, String text) {
    if (text.trim().isEmpty) return;
    if (out.isNotEmpty && out.last.type == type) {
      out.last.text += '\n$text';
    } else {
      out.add(ProseSegment(type, text));
    }
  }

  for (final line in input.split('\n')) {
    final dash = _dashLine.firstMatch(line);
    if (dash != null) {
      push(ProseSegmentType.dialogue, line.substring(dash.end).trim());
      continue;
    }
    var i = 0;
    final buf = StringBuffer();
    void flush() {
      if (buf.isNotEmpty) {
        push(ProseSegmentType.narrative, buf.toString());
        buf.clear();
      }
    }

    while (i < line.length) {
      final ch = line[i];
      final closer = _closers[ch];
      if (closer != null) {
        final end = line.indexOf(closer, i + 1);
        flush();
        if (end == -1) {
          push(ProseSegmentType.dialogue, line.substring(i + 1).trim());
          i = line.length;
        } else {
          push(ProseSegmentType.dialogue, line.substring(i + 1, end).trim());
          i = end + 1;
        }
      } else {
        buf.write(ch);
        i += 1;
      }
    }
    flush();
  }
  return out
      .map((s) => ProseSegment(s.type, s.text.trim()))
      .where((s) => s.text.isNotEmpty)
      .toList();
}
