import 'character_creation.dart';

class AbilityModel {
  final String id;
  final String name;
  final String description;
  final String type; // passive, active, spell, technique
  final String? icon;
  final int tier;
  final String? linkedStatId;
  final String? effectSummary;
  final List<String> allowedArchetypeIds;

  const AbilityModel({
    required this.id,
    required this.name,
    required this.description,
    this.type = 'passive',
    this.icon,
    this.tier = 1,
    this.linkedStatId,
    this.effectSummary,
    this.allowedArchetypeIds = const [],
  });

  factory AbilityModel.fromJson(Map<String, dynamic> json) {
    final rawArchetypes = json['allowedArchetypeIds'] as List<dynamic>? ?? [];
    return AbilityModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      type: json['type'] ?? 'passive',
      icon: json['icon'],
      tier: (json['tier'] as num?)?.toInt() ?? 1,
      linkedStatId: json['linkedStatId'],
      effectSummary: json['effectSummary'],
      allowedArchetypeIds: rawArchetypes.map((e) => e.toString()).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'type': type,
        if (icon != null) 'icon': icon,
        'tier': tier,
        if (linkedStatId != null) 'linkedStatId': linkedStatId,
        if (effectSummary != null) 'effectSummary': effectSummary,
        'allowedArchetypeIds': allowedArchetypeIds,
      };
}

class StoryStatSummary {
  final String id;
  final String name;
  final String? nameFa;
  final String? nameEn;
  final String description;
  final int baseValue;

  const StoryStatSummary({
    required this.id,
    required this.name,
    this.nameFa,
    this.nameEn,
    required this.description,
    this.baseValue = 10,
  });

  factory StoryStatSummary.fromJson(Map<String, dynamic> json) {
    final rawName = (json['name'] as String?)?.trim();
    final rawNameFa = (json['nameFa'] as String?)?.trim();
    final rawNameEn = (json['nameEn'] as String?)?.trim();
    final primaryName = (rawName != null && rawName.isNotEmpty)
        ? rawName
        : (rawNameFa != null && rawNameFa.isNotEmpty)
            ? rawNameFa
            : (rawNameEn != null && rawNameEn.isNotEmpty)
                ? rawNameEn
                : '';
    // Studio uses `baseValue`; theme-synthesis payloads use `defaultValue`.
    // Accept both (plus legacy `value`) so we never fall back to a
    // hardcoded 10 when the author defined a different baseline.
    final rawBase = json['baseValue'] ?? json['defaultValue'] ?? json['value'];
    return StoryStatSummary(
      id: json['id'] ?? '',
      name: primaryName,
      nameFa: rawNameFa,
      nameEn: rawNameEn,
      description: json['description'] ?? '',
      baseValue: (rawBase as num?)?.toInt() ?? 10,
    );
  }

  String getLocalizedName(bool isPersian) {
    if (name.trim().isNotEmpty) {
      return name.trim();
    }
    if (isPersian && nameFa != null && nameFa!.trim().isNotEmpty) {
      return nameFa!.trim();
    }
    if (!isPersian && nameEn != null && nameEn!.trim().isNotEmpty) {
      return nameEn!.trim();
    }
    if (nameFa != null && nameFa!.trim().isNotEmpty) {
      return nameFa!.trim();
    }
    if (nameEn != null && nameEn!.trim().isNotEmpty) {
      return nameEn!.trim();
    }
    return id;
  }
}

class StorySummary {
  final String id;
  final String title;
  final String tagline;
  final String synopsis;
  final List<String> genres;
  final String language;
  final String coverImageUrl;
  final String author;
  final List<String> statsPreview;
  final List<StoryStatSummary> stats;
  final List<ArchetypeModel> archetypes;
  final List<BackgroundOriginModel> backgrounds;
  final List<AbilityModel> abilities;
  final int universalBaseValue;
  final Map<String, dynamic>? progressionConfig;
  final StoryUpdateNotice? updateNotice;
  final String engineTier;

  StorySummary({
    required this.id,
    required this.title,
    required this.tagline,
    required this.synopsis,
    required this.genres,
    required this.language,
    required this.coverImageUrl,
    required this.author,
    required this.statsPreview,
    this.stats = const [],
    this.archetypes = const [],
    this.backgrounds = const [],
    this.abilities = const [],
    this.universalBaseValue = 10,
    this.progressionConfig,
    this.updateNotice,
    this.engineTier = 'normal',
  });

  int get sceneCreditCost => engineTier == 'advance' ? 5 : engineTier == 'plus' ? 2 : 1;
  String get engineTierLabel => engineTier == 'advance' ? 'Advance 5x' : engineTier == 'plus' ? 'Plus 2x' : 'Normal';
  String get engineTierLabelFa => engineTier == 'advance' ? 'فوق‌پیشرفته ۵x' : engineTier == 'plus' ? 'پیشرفته ۲x' : 'معمولی';

  factory StorySummary.fromJson(Map<String, dynamic> json) {
    List<String> parseList(dynamic val) {
      if (val is List) {
        return val.map((e) => e.toString()).toList();
      } else if (val is String) {
        return val.split(' ').where((s) => s.isNotEmpty).toList();
      }
      return [];
    }

    final rawStats = json['stats'] as List<dynamic>? ?? [];
    final rawArch = json['archetypes'] as List<dynamic>? ?? [];
    final rawBg = json['backgrounds'] as List<dynamic>? ?? [];
    // The play API nests abilities under rpgSystem; accept top-level too.
    final rawAbilities = json['abilities'] as List<dynamic>? ?? json['rpgSystem']?['abilities'] as List<dynamic>? ?? [];

    StoryUpdateNotice? parsedNotice;
    final noticeJson = json['updateNotice'];
    if (noticeJson is Map<String, dynamic> && noticeJson['enabled'] == true) {
      parsedNotice = StoryUpdateNotice.fromJson(noticeJson);
    }

    return StorySummary(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      tagline: json['tagline'] ?? '',
      synopsis: json['synopsis'] ?? '',
      genres: parseList(json['genres']),
      language: json['language'] ?? 'en',
      coverImageUrl: json['coverImageUrl'] ?? '',
      author: json['author'] ?? '',
      statsPreview: parseList(json['statsPreview']),
      stats: rawStats.map((s) => StoryStatSummary.fromJson(s as Map<String, dynamic>)).toList(),
      archetypes: rawArch.map((a) => ArchetypeModel.fromJson(a as Map<String, dynamic>)).toList(),
      backgrounds: rawBg.map((b) => BackgroundOriginModel.fromJson(b as Map<String, dynamic>)).toList(),
      abilities: rawAbilities.map((ab) => AbilityModel.fromJson(ab as Map<String, dynamic>)).toList(),
      universalBaseValue: (json['universalBaseValue'] ?? json['rpgSystem']?['universalBaseValue'] as num?)?.toInt() ?? 10,
      progressionConfig: json['rpgSystem']?['progression'] as Map<String, dynamic>?,
      updateNotice: parsedNotice,
      engineTier: json['engineTier'] as String? ?? 'normal',
    );
  }
}

class StoryUpdateNotice {
  final String id;
  final bool enabled;
  final String title;
  final String message;
  final String? actionLabel;
  final bool allowRefund;
  final List<String> targetSceneIds;

  const StoryUpdateNotice({
    this.id = '',
    this.enabled = true,
    required this.title,
    required this.message,
    this.actionLabel,
    this.allowRefund = true,
    this.targetSceneIds = const [],
  });

  factory StoryUpdateNotice.fromJson(Map<String, dynamic> json) {
    return StoryUpdateNotice(
      id: json['id'] as String? ?? '',
      enabled: json['enabled'] as bool? ?? true,
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      actionLabel: json['actionLabel'] as String?,
      allowRefund: json['allowRefund'] as bool? ?? true,
      targetSceneIds: (json['targetSceneIds'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'enabled': enabled,
        'title': title,
        'message': message,
        if (actionLabel != null) 'actionLabel': actionLabel,
        'allowRefund': allowRefund,
        'targetSceneIds': targetSceneIds,
      };
}
