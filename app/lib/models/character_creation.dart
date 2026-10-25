import 'game_state.dart';
import 'story.dart';

class ArchetypeModel {
  final String id;
  final String name;
  final String tagline;
  final String description;
  final String? iconName;
  final Map<String, int> statBonuses;
  final PlayerEquipment? startingEquipment;
  final List<GameItem> bonusItems;
  final List<String> startingAbilities;

  const ArchetypeModel({
    required this.id,
    required this.name,
    required this.tagline,
    required this.description,
    this.iconName,
    this.statBonuses = const {},
    this.startingEquipment,
    this.bonusItems = const [],
    this.startingAbilities = const [],
  });

  factory ArchetypeModel.fromJson(Map<String, dynamic> json) {
    final rawBonuses = json['statBonuses'] as Map<String, dynamic>? ?? {};
    final rawBonusItems = json['bonusItems'] as List<dynamic>? ?? [];
    final rawAbilities = json['startingAbilities'];

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
      startingAbilities: rawAbilities is List
          ? rawAbilities.map((e) => e.toString()).toList()
          : const [],
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
        'startingAbilities': startingAbilities,
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

  /// Generates a battle-ready default character setup with all 4 free stat points
  /// intelligently auto-appointed according to archetype affinities.
  factory CharacterSetupPayload.quickStart(StorySummary story, {bool isPersian = true}) {
    final archetypes = story.archetypes;
    final backgrounds = story.backgrounds;

    final selectedArch = archetypes.isNotEmpty ? archetypes.first : null;
    final selectedBg = backgrounds.isNotEmpty ? backgrounds.first : null;

    // 1. Sort stats by archetype affinity bonus descending
    final stats = story.stats;
    final sortedStats = stats.toList()
      ..sort((a, b) {
        final aBonus = selectedArch?.statBonuses[a.id] ?? 0;
        final bBonus = selectedArch?.statBonuses[b.id] ?? 0;
        return bBonus.compareTo(aBonus);
      });

    // 2. Appoint all 4 free points (2 to primary affinity, 2 to secondary affinity)
    final Map<String, int> allocatedFreePoints = {};
    for (final s in stats) {
      allocatedFreePoints[s.id] = 0;
    }
    if (sortedStats.isNotEmpty) {
      if (sortedStats.length == 1) {
        allocatedFreePoints[sortedStats[0].id] = 4;
      } else {
        allocatedFreePoints[sortedStats[0].id] = 2;
        allocatedFreePoints[sortedStats[1].id] = 2;
      }
    }

    // 3. Compute final authoritative allocatedStats (base + archBonus + bgBonus + appointed)
    final Map<String, int> finalAllocatedStats = {};
    for (final s in stats) {
      final base = s.baseValue;
      final archBonus = selectedArch?.statBonuses[s.id] ?? 0;
      final bgBonus = selectedBg?.statBonuses[s.id] ?? 0;
      final freePoint = allocatedFreePoints[s.id] ?? 0;
      finalAllocatedStats[s.id] = base + archBonus + bgBonus + freePoint;
    }

    final defaultName = isPersian ? 'برزین' : (selectedArch?.name.isNotEmpty == true ? selectedArch!.name : 'Wanderer');

    return CharacterSetupPayload(
      archetypeId: selectedArch?.id,
      backgroundId: selectedBg?.id,
      allocatedStats: finalAllocatedStats,
      characterName: defaultName,
    );
  }

  Map<String, dynamic> toJson() => {
        if (archetypeId != null) 'archetypeId': archetypeId,
        if (backgroundId != null) 'backgroundId': backgroundId,
        if (allocatedStats != null) 'allocatedStats': allocatedStats,
        if (characterName != null && characterName!.trim().isNotEmpty)
          'characterName': characterName!.trim(),
      };
}
