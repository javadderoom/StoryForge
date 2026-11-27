import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/providers/game_session_provider.dart';
import 'package:afsanehsaz/services/game_api_service.dart';
import 'package:afsanehsaz/ui/widgets/item_detail_sheet.dart';

void main() {
  group('GameItem imageUrl & media resolvers', () {
    test('GameItem preserves imageUrl across fromJson and toJson', () {
      final item = GameItem.fromJson({
        'id': 'art_chahsang_water_tally',
        'name': 'چوب‌خط برنجی',
        'description': 'نشان سهمیه آب',
        'type': 'quest_item',
        'quantity': 1,
        'imageUrl': 'https://example.com/tally.webp',
      });

      expect(item.imageUrl, 'https://example.com/tally.webp');
      expect(item.toJson()['imageUrl'], 'https://example.com/tally.webp');

      final noImg = GameItem.fromJson({
        'id': 'iron_dagger',
        'name': 'خنجر آهنی',
        'description': '',
        'type': 'weapon',
        'quantity': 1,
        'imageUrl': '   ',
      });
      expect(noImg.imageUrl, isNull);
      expect(noImg.toJson().containsKey('imageUrl'), isFalse);
    });

    test('GameSessionState resolves location, artifact, and relative media URLs', () {
      final lore = <String, dynamic>{
        'locations': [
          {'id': 'loc_chahsang', 'name': 'چاه سنگ', 'imageUrl': '/images/locations/loc_chahsang.webp'},
          {'id': 'loc_empty', 'name': 'دشت', 'imageUrl': ''},
        ],
        'artifacts': [
          {'id': 'art_1', 'name': 'چوب‌خط', 'imageUrl': 'https://cdn.test/art_1.webp'},
        ],
      };

      expect(
        GameSessionState.locationImageUrl(lore, 'loc_chahsang'),
        '/images/locations/loc_chahsang.webp',
      );
      expect(GameSessionState.locationImageUrl(lore, 'loc_empty'), isNull);
      expect(
        GameSessionState.artifactImageUrl(lore, 'art_1'),
        'https://cdn.test/art_1.webp',
      );
      expect(
        GameSessionState.resolveMediaUrl('/images/locations/loc_chahsang.webp'),
        '${GameApiService.baseUrl}/images/locations/loc_chahsang.webp',
      );
      expect(
        GameSessionState.resolveMediaUrl('//cdn.test/x.webp'),
        'https://cdn.test/x.webp',
      );
    });

    testWidgets('ItemDetailSheet renders cleanly with artwork URL', (tester) async {
      final item = GameItem(
        id: 'art_chahsang_water_tally',
        name: 'چوب‌خط برنجی حق‌آبه',
        description: 'سند آب کاروان',
        type: 'quest_item',
        quantity: 1,
        imageUrl: 'https://example.com/tally.webp',
        nonEquippable: true,
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: ItemDetailSheet(
                item: item,
                isPersian: true,
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('چوب‌خط برنجی حق‌آبه'), findsOneWidget);
      expect(find.text('سند آب کاروان'), findsOneWidget);
    });
  });
}
