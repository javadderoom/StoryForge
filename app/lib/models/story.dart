import 'character_creation.dart';

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
    return StoryStatSummary(
      id: json['id'] ?? '',
      name: primaryName,
      nameFa: rawNameFa,
      nameEn: rawNameEn,
      description: json['description'] ?? '',
      baseValue: (json['baseValue'] as num?)?.toInt() ?? 10,
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
  });

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
    );
  }
}
