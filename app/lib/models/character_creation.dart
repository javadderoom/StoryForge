import 'game_state.dart';

class ArchetypeModel {
  final String id;
  final String name;
  final String tagline;
  final String description;
  final String? iconName;
  final Map<String, int> statBonuses;
  final PlayerEquipment? startingEquipment;
  final List<GameItem> bonusItems;

  const ArchetypeModel({
    required this.id,
    required this.name,
    required this.tagline,
    required this.description,
    this.iconName,
    this.statBonuses = const {},
    this.startingEquipment,
    this.bonusItems = const [],
  });

  factory ArchetypeModel.fromJson(Map<String, dynamic> json) {
    final rawBonuses = json['statBonuses'] as Map<String, dynamic>? ?? {};
    final rawBonusItems = json['bonusItems'] as List<dynamic>? ?? [];

    return ArchetypeModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      tagline: json['tagline'] ?? '',
      description: json['description'] ?? '',
      iconName: json['iconName'],
      statBonuses: rawBonuses.map((k, v) => MapEntry(k, (v as num).toInt())),
      startingEquipment: json['startingEquipment'] != null
          ? PlayerEquipment.fromJson(json['startingEquipment'] as Map<String, dynamic>)
          : null,
      bonusItems: rawBonusItems.map((i) => GameItem.fromJson(i as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'tagline': tagline,
        'description': description,
        'iconName': iconName,
        'statBonuses': statBonuses,
        'startingEquipment': startingEquipment?.toJson(),
        'bonusItems': bonusItems.map((i) => i.toJson()).toList(),
      };
}

class BackgroundOriginModel {
  final String id;
  final String name;
  final String description;
  final String trait;
  final String? narrativePromptHook;
  final Map<String, int> statBonuses;

  const BackgroundOriginModel({
    required this.id,
    required this.name,
    required this.description,
    required this.trait,
    this.narrativePromptHook,
    this.statBonuses = const {},
  });

  factory BackgroundOriginModel.fromJson(Map<String, dynamic> json) {
    final rawBonuses = json['statBonuses'] as Map<String, dynamic>? ?? {};

    return BackgroundOriginModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      trait: json['trait'] ?? '',
      narrativePromptHook: json['narrativePromptHook'],
      statBonuses: rawBonuses.map((k, v) => MapEntry(k, (v as num).toInt())),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'trait': trait,
        'narrativePromptHook': narrativePromptHook,
        'statBonuses': statBonuses,
      };
}

class CharacterSetupPayload {
  final String? archetypeId;
  final String? backgroundId;
  final Map<String, int>? allocatedStats;
  final String? characterName;

  const CharacterSetupPayload({
    this.archetypeId,
    this.backgroundId,
    this.allocatedStats,
    this.characterName,
  });

  Map<String, dynamic> toJson() => {
        if (archetypeId != null) 'archetypeId': archetypeId,
        if (backgroundId != null) 'backgroundId': backgroundId,
        if (allocatedStats != null) 'allocatedStats': allocatedStats,
        if (characterName != null && characterName!.trim().isNotEmpty)
          'characterName': characterName!.trim(),
      };
}
