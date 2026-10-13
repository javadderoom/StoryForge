class UserProfile {
  final String id;
  final String phoneNumber;
  final String? email;
  final String? bazaarAccountId;
  final String? name;
  final String role;
  final int creditBalance;
  final bool phoneVerified;
  final bool emailVerified;

  const UserProfile({
    required this.id,
    required this.phoneNumber,
    this.email,
    this.bazaarAccountId,
    this.name,
    this.role = 'READER',
    this.creditBalance = 0,
    this.phoneVerified = false,
    this.emailVerified = false,
  });

  bool get hasContact => phoneNumber.isNotEmpty || (email != null && email!.isNotEmpty);

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] ?? '',
      phoneNumber: json['phoneNumber'] ?? '',
      email: json['email'],
      bazaarAccountId: json['bazaarAccountId'],
      name: json['name'],
      role: json['role'] ?? 'READER',
      creditBalance: (json['creditBalance'] as num?)?.toInt() ?? 0,
      phoneVerified: json['phoneVerified'] ?? false,
      emailVerified: json['emailVerified'] ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'phoneNumber': phoneNumber,
        'email': email,
        'bazaarAccountId': bazaarAccountId,
        'name': name,
        'role': role,
        'creditBalance': creditBalance,
        'phoneVerified': phoneVerified,
        'emailVerified': emailVerified,
      };

  UserProfile copyWith({
    String? id,
    String? phoneNumber,
    String? email,
    String? bazaarAccountId,
    String? name,
    String? role,
    int? creditBalance,
    bool? phoneVerified,
    bool? emailVerified,
  }) {
    return UserProfile(
      id: id ?? this.id,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      email: email ?? this.email,
      bazaarAccountId: bazaarAccountId ?? this.bazaarAccountId,
      name: name ?? this.name,
      role: role ?? this.role,
      creditBalance: creditBalance ?? this.creditBalance,
      phoneVerified: phoneVerified ?? this.phoneVerified,
      emailVerified: emailVerified ?? this.emailVerified,
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
