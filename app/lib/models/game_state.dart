enum ItemRarity { common, uncommon, rare, epic, legendary }

enum WeaponGrip { oneHanded, twoHanded, offHandOnly }

class GameItem {
  final String id;
  final String name;
  final String description;
  final String type; // weapon, armor, consumable, relic, quest_item
  final ItemRarity rarity;
  final WeaponGrip? grip;
  final int quantity;
  final Map<String, int> statModifiers;
  final int? healValue;
  final int? staminaValue;
  final bool isConsumable;

  GameItem({
    required this.id,
    required this.name,
    required this.description,
    required this.type,
    this.rarity = ItemRarity.common,
    this.grip,
    required this.quantity,
    this.statModifiers = const {},
    this.healValue,
    this.staminaValue,
    this.isConsumable = false,
  });

  factory GameItem.fromJson(Map<String, dynamic> json) {
    ItemRarity parseRarity(String? val) {
      switch (val?.toLowerCase()) {
        case 'uncommon':
          return ItemRarity.uncommon;
        case 'rare':
          return ItemRarity.rare;
        case 'epic':
          return ItemRarity.epic;
        case 'legendary':
          return ItemRarity.legendary;
        default:
          return ItemRarity.common;
      }
    }

    WeaponGrip? parseGrip(String? val) {
      if (val == null) return null;
      final normalized = val.toLowerCase().replaceAll('_', '').replaceAll('-', '');
      switch (normalized) {
        case 'twohanded':
          return WeaponGrip.twoHanded;
        case 'offhandonly':
        case 'offhand':
          return WeaponGrip.offHandOnly;
        case 'onehanded':
          return WeaponGrip.oneHanded;
        default:
          return null;
      }
    }

    final rawMods = json['statModifiers'] as Map<String, dynamic>? ?? {};
    final mods = rawMods.map((k, v) => MapEntry(k, (v as num).toInt()));

    return GameItem(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'misc',
      rarity: parseRarity(json['rarity']),
      grip: parseGrip(json['grip']),
      quantity: json['quantity'] ?? 1,
      statModifiers: mods,
      healValue: json['healValue'],
      staminaValue: json['staminaValue'],
      isConsumable: json['isConsumable'] ??
          (json['type'] == 'consumable' ||
              json['type'] == 'potion' ||
              json['healValue'] != null ||
              json['staminaValue'] != null),
    );
  }

  String? get gripSnakeCase {
    switch (grip) {
      case WeaponGrip.oneHanded:
        return 'one_handed';
      case WeaponGrip.twoHanded:
        return 'two_handed';
      case WeaponGrip.offHandOnly:
        return 'off_hand_only';
      case null:
        return null;
    }
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'type': type,
        'rarity': rarity.name,
        'grip': gripSnakeCase,
        'quantity': quantity,
        'statModifiers': statModifiers,
        'healValue': healValue,
        'staminaValue': staminaValue,
        'isConsumable': isConsumable,
      };
}

class PlayerEquipment {
  final String? mainHand; // 1H or 2H weapon
  final String? offHand; // 1H weapon or shield (null if mainHand is 2H)
  final String? armor; // Armor / Robes
  final String? relic; // Amulet / Ring / Talisman

  const PlayerEquipment({
    this.mainHand,
    this.offHand,
    this.armor,
    this.relic,
  });

  bool isEquipped(String itemId) {
    return mainHand == itemId || offHand == itemId || armor == itemId || relic == itemId;
  }

  List<String> get allEquippedIds => [
        ?mainHand,
        ?offHand,
        ?armor,
        ?relic,
      ];

  PlayerEquipment copyWith({
    String? mainHand,
    String? offHand,
    String? armor,
    String? relic,
    bool clearMainHand = false,
    bool clearOffHand = false,
    bool clearArmor = false,
    bool clearRelic = false,
  }) {
    return PlayerEquipment(
      mainHand: clearMainHand ? null : (mainHand ?? this.mainHand),
      offHand: clearOffHand ? null : (offHand ?? this.offHand),
      armor: clearArmor ? null : (armor ?? this.armor),
      relic: clearRelic ? null : (relic ?? this.relic),
    );
  }

  factory PlayerEquipment.fromJson(Map<String, dynamic> json) {
    return PlayerEquipment(
      mainHand: json['mainHand'],
      offHand: json['offHand'],
      armor: json['armor'],
      relic: json['relic'],
    );
  }

  Map<String, dynamic> toJson() => {
        'mainHand': mainHand,
        'offHand': offHand,
        'armor': armor,
        'relic': relic,
      };
}

class CheckResolution {
  final String outcome;
  final int diceRoll;
  final int statModifier;
  final int totalScore;
  final int difficultyClass;
  final String consequenceSummary;
  final String? statId;

  CheckResolution({
    required this.outcome,
    required this.diceRoll,
    this.statModifier = 0,
    required this.totalScore,
    required this.difficultyClass,
    required this.consequenceSummary,
    this.statId,
  });

  factory CheckResolution.fromJson(Map<String, dynamic> json) {
    return CheckResolution(
      outcome: json['outcome'] ?? 'success',
      diceRoll: json['diceRoll'] ?? 10,
      statModifier: json['statModifier'] ?? 0,
      totalScore: json['totalScore'] ?? 10,
      difficultyClass: json['difficultyClass'] ?? 10,
      consequenceSummary: json['consequenceSummary'] ?? '',
      statId: json['statId'],
    );
  }
}

class NpcRelationship {
  final int trust; // -100 to 100
  final List<String> knownSecrets;
  final List<String> notes;

  const NpcRelationship({
    this.trust = 0,
    this.knownSecrets = const [],
    this.notes = const [],
  });

  factory NpcRelationship.fromJson(Map<String, dynamic> json) {
    return NpcRelationship(
      trust: (json['trust'] as num?)?.toInt() ?? 0,
      knownSecrets: (json['knownSecrets'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      notes: (json['notes'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'trust': trust,
        'knownSecrets': knownSecrets,
        'notes': notes,
      };
}

class PlayerState {
  final Map<String, int> stats;
  final Map<String, int> resources;
  final List<GameItem> inventory;
  final PlayerEquipment equipment;
  final String currentLocationId;
  final List<String> discoveredLocationIds;
  final Map<String, NpcRelationship> relationships;
  final List<String> activeQuestIds;
  final List<String> completedQuestIds;

  PlayerState({
    required this.stats,
    required this.resources,
    required this.inventory,
    this.equipment = const PlayerEquipment(),
    required this.currentLocationId,
    this.discoveredLocationIds = const [],
    this.relationships = const {},
    this.activeQuestIds = const [],
    this.completedQuestIds = const [],
  });

  GameItem? getItem(String itemId) {
    try {
      return inventory.firstWhere((i) => i.id == itemId);
    } catch (_) {
      return null;
    }
  }

  /// Calculates total effective stat value factoring in all equipped items
  int getEffectiveStat(String statId) {
    int base = stats[statId] ?? 10;
    int bonus = 0;

    for (final eqId in equipment.allEquippedIds) {
      final item = getItem(eqId);
      if (item != null && item.statModifiers.containsKey(statId)) {
        bonus += item.statModifiers[statId]!;
      }
    }
    return base + bonus;
  }

  PlayerState copyWith({
    Map<String, int>? stats,
    Map<String, int>? resources,
    List<GameItem>? inventory,
    PlayerEquipment? equipment,
    String? currentLocationId,
    List<String>? discoveredLocationIds,
    Map<String, NpcRelationship>? relationships,
    List<String>? activeQuestIds,
    List<String>? completedQuestIds,
  }) {
    return PlayerState(
      stats: stats ?? this.stats,
      resources: resources ?? this.resources,
      inventory: inventory ?? this.inventory,
      equipment: equipment ?? this.equipment,
      currentLocationId: currentLocationId ?? this.currentLocationId,
      discoveredLocationIds: discoveredLocationIds ?? this.discoveredLocationIds,
      relationships: relationships ?? this.relationships,
      activeQuestIds: activeQuestIds ?? this.activeQuestIds,
      completedQuestIds: completedQuestIds ?? this.completedQuestIds,
    );
  }

  factory PlayerState.fromJson(Map<String, dynamic> json) {
    final rawStats = json['stats'] as Map<String, dynamic>? ?? {};
    final rawRes = json['resources'] as Map<String, dynamic>? ?? {};
    final rawInv = json['inventory'] as List<dynamic>? ?? [];
    final rawEq = json['equipment'] as Map<String, dynamic>? ?? {};
    final rawLocs = json['discoveredLocationIds'] as List<dynamic>? ?? [];
    final rawRel = json['relationships'] as Map<String, dynamic>? ?? {};
    final rawActiveQuests = json['activeQuestIds'] as List<dynamic>? ?? [];
    final rawCompQuests = json['completedQuestIds'] as List<dynamic>? ?? [];

    return PlayerState(
      stats: rawStats.map((k, v) => MapEntry(k, (v as num).toInt())),
      resources: rawRes.map((k, v) => MapEntry(k, (v as num).toInt())),
      inventory: rawInv.map((i) => GameItem.fromJson(i)).toList(),
      equipment: PlayerEquipment.fromJson(rawEq),
      currentLocationId: json['currentLocationId'] ?? '',
      discoveredLocationIds: rawLocs.map((e) => e.toString()).toList(),
      relationships: rawRel.map((k, v) => MapEntry(k, NpcRelationship.fromJson(v as Map<String, dynamic>))),
      activeQuestIds: rawActiveQuests.map((e) => e.toString()).toList(),
      completedQuestIds: rawCompQuests.map((e) => e.toString()).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'stats': stats,
        'resources': resources,
        'inventory': inventory.map((i) => i.toJson()).toList(),
        'equipment': equipment.toJson(),
        'currentLocationId': currentLocationId,
        'discoveredLocationIds': discoveredLocationIds,
        'relationships': relationships.map((k, v) => MapEntry(k, v.toJson())),
        'activeQuestIds': activeQuestIds,
        'completedQuestIds': completedQuestIds,
      };
}
