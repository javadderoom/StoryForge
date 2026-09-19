import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/ui/widgets/creature_discovery_card.dart';

void main() {
  group('Creature Discovery Model & State Tests', () {
    test('DiscoveredCreature correctly parses JSON payload from engine', () {
      final json = {
        'id': 'creature_mtt46cnd_55nq',
        'name': 'افعی رسوبی',
        'speciesCategory': 'beast',
        'dangerLevel': 2,
        'rarity': 'common',
        'isDomesticated': false,
        'habitatLocationIds': ['loc_mtr2c3uu_yocj'],
        'behavioralTactics': 'کمین در بستر لجن و گل‌های حاشیهٔ رود',
        'weaknesses': ['ضربه به جمجمه', 'سرمای ناگهانی'],
        'resistances': ['زهر گل‌آلود'],
        'harvestableLoot': [
          {'itemId': 'loot_venom_gland', 'name': 'کیسه زهر افعی', 'dropRate': '70%'}
        ],
        'loreDescription': 'ماری تنومند با فلس‌های ضخیم و آجری‌رنگ',
      };

      final creature = DiscoveredCreature.fromJson(json);

      expect(creature.id, equals('creature_mtt46cnd_55nq'));
      expect(creature.name, equals('افعی رسوبی'));
      expect(creature.speciesCategory, equals('beast'));
      expect(creature.dangerLevel, equals(2));
      expect(creature.weaknesses, contains('ضربه به جمجمه'));
      expect(creature.resistances, contains('زهر گل‌آلود'));
      expect(creature.harvestableLoot.length, equals(1));
      expect(creature.harvestableLoot.first['name'], equals('کیسه زهر افعی'));

      final serialized = creature.toJson();
      expect(serialized['name'], equals('افعی رسوبی'));
      expect(serialized['dangerLevel'], equals(2));
    });

    test('PlayerState tracks discoveredCreatureIds across sessions', () {
      final playerJson = {
        'characterName': 'برزین',
        'currentLocationId': 'loc_mtr2c3uu_yocj',
        'stats': {'might': 15, 'agility': 13},
        'resources': {'hp': 20},
        'inventory': [],
        'discoveredCreatureIds': ['creature_mtt46cnd_55nq'],
      };

      final player = PlayerState.fromJson(playerJson);
      expect(player.discoveredCreatureIds, contains('creature_mtt46cnd_55nq'));

      final updated = player.copyWith(
        discoveredCreatureIds: [...player.discoveredCreatureIds, 'creature_crocodile_99'],
      );
      expect(updated.discoveredCreatureIds.length, equals(2));
      expect(updated.toJson()['discoveredCreatureIds'], contains('creature_crocodile_99'));
    });
  });

  group('CreatureDiscoveryCard Widget Tests', () {
    const testCreature = DiscoveredCreature(
      id: 'creature_viper_1',
      name: 'افعی رسوبی',
      speciesCategory: 'beast',
      dangerLevel: 2,
      loreDescription: 'ماری با فلس‌های آجری و حرکات غافلگیرکننده.',
      behavioralTactics: 'کمین در گل‌ولای مرطوب رودخانه.',
      weaknesses: ['سپر کوبنده'],
      resistances: ['سموم رودخانه‌ای'],
    );

    testWidgets('renders creature card with name, category, and threat pips', (tester) async {
      bool dismissed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CreatureDiscoveryCard(
              creature: testCreature,
              isPersian: true,
              onDismiss: () => dismissed = true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('افعی رسوبی'), findsOneWidget);
      expect(find.text('ثبت جدید در کتاب جانوران'), findsOneWidget);
      expect(find.text('جانور وحشی'), findsOneWidget);
      expect(find.text('ماری با فلس‌های آجری و حرکات غافلگیرکننده.'), findsOneWidget);
      expect(find.text('کمین در گل‌ولای مرطوب رودخانه.'), findsOneWidget);

      // Verify dismiss button triggers callback
      final dismissBtn = find.byIcon(Icons.close_rounded);
      expect(dismissBtn, findsOneWidget);
      await tester.tap(dismissBtn);
      expect(dismissed, isTrue);
    });

    testWidgets('toggles expand and collapse of creature details', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CreatureDiscoveryCard(
              creature: testCreature,
              isPersian: true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('ماری با فلس‌های آجری و حرکات غافلگیرکننده.'), findsOneWidget);

      // Tap 'بستن' to collapse
      final toggleBtn = find.text('بستن');
      expect(toggleBtn, findsOneWidget);
      await tester.tap(toggleBtn);
      await tester.pumpAndSettle();

      // Details should now be hidden
      expect(find.text('ماری با فلس‌های آجری و حرکات غافلگیرکننده.'), findsNothing);
      expect(find.text('جزئیات'), findsOneWidget);
    });
  });
}
