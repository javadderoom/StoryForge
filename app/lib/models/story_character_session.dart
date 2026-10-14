class StoryCharacterSession {
  final String sessionId;
  final String storyId;
  final String currentSceneId;
  final int turnCount;
  final String characterName;
  final String? archetypeId;
  final String archetypeName;
  final String? backgroundId;
  final String backgroundName;
  final int level;
  final String? currentLocationId;
  final Map<String, dynamic> stats;
  final Map<String, dynamic> resources;
  final Map<String, dynamic> maxResources;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const StoryCharacterSession({
    required this.sessionId,
    required this.storyId,
    required this.currentSceneId,
    required this.turnCount,
    required this.characterName,
    this.archetypeId,
    required this.archetypeName,
    this.backgroundId,
    required this.backgroundName,
    this.level = 1,
    this.currentLocationId,
    this.stats = const {},
    this.resources = const {},
    this.maxResources = const {},
    this.createdAt,
    this.updatedAt,
  });

  factory StoryCharacterSession.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic d) {
      if (d == null) return null;
      if (d is DateTime) return d;
      try {
        return DateTime.parse(d.toString());
      } catch (_) {
        return null;
      }
    }

    return StoryCharacterSession(
      sessionId: json['sessionId'] as String? ?? '',
      storyId: json['storyId'] as String? ?? '',
      currentSceneId: json['currentSceneId'] as String? ?? '',
      turnCount: (json['turnCount'] as num?)?.toInt() ?? 1,
      characterName: (json['characterName'] as String?)?.isNotEmpty == true
          ? json['characterName'] as String
          : 'بی‌نام',
      archetypeId: json['archetypeId'] as String?,
      archetypeName: (json['archetypeName'] as String?)?.isNotEmpty == true
          ? json['archetypeName'] as String
          : 'ماجراجو',
      backgroundId: json['backgroundId'] as String?,
      backgroundName: (json['backgroundName'] as String?)?.isNotEmpty == true
          ? json['backgroundName'] as String
          : 'سرگردان',
      level: (json['level'] as num?)?.toInt() ?? 1,
      currentLocationId: json['currentLocationId'] as String?,
      stats: json['stats'] is Map ? Map<String, dynamic>.from(json['stats'] as Map) : const {},
      resources: json['resources'] is Map ? Map<String, dynamic>.from(json['resources'] as Map) : const {},
      maxResources: json['maxResources'] is Map ? Map<String, dynamic>.from(json['maxResources'] as Map) : const {},
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
    );
  }
}
