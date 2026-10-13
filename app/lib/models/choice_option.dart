class ChoiceOption {
  final String id;
  final String text;
  final String style;
  final String riskLevel; // 'low', 'medium', 'high'
  final String? requiredStatId;
  final int? targetDC;
  final String? targetSceneId;

  ChoiceOption({
    required this.id,
    required this.text,
    required this.style,
    required this.riskLevel,
    this.requiredStatId,
    this.targetDC,
    this.targetSceneId,
  });

  factory ChoiceOption.fromJson(Map<String, dynamic> json) {
    final rawText = json['text'] as String? ?? '';
    final cleanedText = rawText
        .replaceAll(
          RegExp(
            r'\s*[\(\[\{]\s*(?:roll check|skill check|stat check|ability check|dice check|dice roll|d20 check|d20|check|dc\s*\d+|بررسی مهارت|بررسی صفت|بررسی ویژگی|بررسی تاس|پرتاب تاس|آزمون مهارت|آزمون ویژگی|آزمون صفت|آزمون|تاس)[\s\S]*?[\)\]\}]',
            caseSensitive: false,
          ),
          '',
        )
        .replaceAll(
          RegExp(
            r'^(?:choice|گزینه|انتخاب)\s*[\d\u0660-\u0669\u06F0-\u06F9]+\s*[:\-–—]\s*',
            caseSensitive: false,
          ),
          '',
        )
        .replaceAll(RegExp(r'^[«"“\x27`](.*)[»"”\x27`]$'), r'$1')
        .trim();

    return ChoiceOption(
      id: json['id'] ?? '',
      text: cleanedText.isNotEmpty ? cleanedText : rawText,
      style: json['style'] ?? 'tactical',
      riskLevel: json['riskLevel'] ?? 'medium',
      requiredStatId: json['requiredStatId'],
      targetDC: json['targetDC'],
      targetSceneId: json['targetSceneId'] ?? json['destinationSceneId'],
    );
  }

  /// Whether this choice requires a D20 dice check.
  /// Routine dialogue, basic movement, and low-stakes actions are diceless.
  bool get requiresRoll =>
      requiredStatId != null &&
      requiredStatId!.trim().isNotEmpty &&
      targetDC != null;
}
