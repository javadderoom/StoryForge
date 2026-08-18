class ChoiceOption {
  final String id;
  final String text;
  final String style;
  final String riskLevel; // 'low', 'medium', 'high'
  final String? requiredStatId;
  final int? targetDC;

  ChoiceOption({
    required this.id,
    required this.text,
    required this.style,
    required this.riskLevel,
    this.requiredStatId,
    this.targetDC,
  });

  factory ChoiceOption.fromJson(Map<String, dynamic> json) {
    return ChoiceOption(
      id: json['id'] ?? '',
      text: json['text'] ?? '',
      style: json['style'] ?? 'tactical',
      riskLevel: json['riskLevel'] ?? 'medium',
      requiredStatId: json['requiredStatId'],
      targetDC: json['targetDC'],
    );
  }
}
