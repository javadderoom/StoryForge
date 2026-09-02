class UserProfile {
  final String id;
  final String phoneNumber;
  final String? name;
  final String role;
  final int creditBalance;
  final bool phoneVerified;

  const UserProfile({
    required this.id,
    required this.phoneNumber,
    this.name,
    this.role = 'READER',
    this.creditBalance = 0,
    this.phoneVerified = false,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] ?? '',
      phoneNumber: json['phoneNumber'] ?? '',
      name: json['name'],
      role: json['role'] ?? 'READER',
      creditBalance: (json['creditBalance'] as num?)?.toInt() ?? 0,
      phoneVerified: json['phoneVerified'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'phoneNumber': phoneNumber,
        'name': name,
        'role': role,
        'creditBalance': creditBalance,
        'phoneVerified': phoneVerified,
      };

  UserProfile copyWith({
    String? id,
    String? phoneNumber,
    String? name,
    String? role,
    int? creditBalance,
    bool? phoneVerified,
  }) {
    return UserProfile(
      id: id ?? this.id,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      name: name ?? this.name,
      role: role ?? this.role,
      creditBalance: creditBalance ?? this.creditBalance,
      phoneVerified: phoneVerified ?? this.phoneVerified,
    );
  }
}

class CreditPackage {
  final String id;
  final String sku;
  final String title;
  final String? titleEn;
  final int credits;
  final int priceToman;
  final int priceRial;
  final String? badge;
  final String description;

  const CreditPackage({
    required this.id,
    required this.sku,
    required this.title,
    this.titleEn,
    required this.credits,
    required this.priceToman,
    this.priceRial = 0,
    this.badge,
    required this.description,
  });

  factory CreditPackage.fromJson(Map<String, dynamic> json) {
    return CreditPackage(
      id: json['id'] ?? '',
      sku: json['sku'] ?? '',
      title: json['title'] ?? '',
      titleEn: json['titleEn'],
      credits: (json['credits'] as num?)?.toInt() ?? 0,
      priceToman: (json['priceToman'] as num?)?.toInt() ?? 0,
      priceRial: (json['priceRial'] as num?)?.toInt() ?? 0,
      badge: json['badge'],
      description: json['description'] ?? '',
    );
  }
}
