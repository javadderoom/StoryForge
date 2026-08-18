class GameItem {
  final String id;
  final String name;
  final String description;
  final String type;
  final int quantity;

  GameItem({
    required this.id,
    required this.name,
    required this.description,
    required this.type,
    required this.quantity,
  });

  factory GameItem.fromJson(Map<String, dynamic> json) {
    return GameItem(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'misc',
      quantity: json['quantity'] ?? 1,
    );
  }
}

class CheckResolution {
  final String outcome;
  final int diceRoll;
  final int totalScore;
  final int difficultyClass;
  final String consequenceSummary;

  CheckResolution({
    required this.outcome,
    required this.diceRoll,
    required this.totalScore,
    required this.difficultyClass,
    required this.consequenceSummary,
  });

  factory CheckResolution.fromJson(Map<String, dynamic> json) {
    return CheckResolution(
      outcome: json['outcome'] ?? 'success',
      diceRoll: json['diceRoll'] ?? 10,
      totalScore: json['totalScore'] ?? 10,
      difficultyClass: json['difficultyClass'] ?? 10,
      consequenceSummary: json['consequenceSummary'] ?? '',
    );
  }
}

class PlayerState {
  final Map<String, int> stats;
  final Map<String, int> resources;
  final List<GameItem> inventory;
  final String currentLocationId;

  PlayerState({
    required this.stats,
    required this.resources,
    required this.inventory,
    required this.currentLocationId,
  });

  factory PlayerState.fromJson(Map<String, dynamic> json) {
    final rawStats = json['stats'] as Map<String, dynamic>? ?? {};
    final rawRes = json['resources'] as Map<String, dynamic>? ?? {};
    final rawInv = json['inventory'] as List<dynamic>? ?? [];

    return PlayerState(
      stats: rawStats.map((k, v) => MapEntry(k, (v as num).toInt())),
      resources: rawRes.map((k, v) => MapEntry(k, (v as num).toInt())),
      inventory: rawInv.map((i) => GameItem.fromJson(i)).toList(),
      currentLocationId: json['currentLocationId'] ?? '',
    );
  }
}
