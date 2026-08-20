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
    );
  }
}
