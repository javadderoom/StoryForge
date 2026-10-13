import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/models/turn_status_delta.dart';
import 'package:afsanehsaz/core/theme/realm_theme.dart';
import 'package:afsanehsaz/ui/widgets/turn_status_delta_banner.dart';

void main() {
  group('TurnStatusDelta computation tests', () {
    test('returns null when there are no changes between player states', () {
      final oldPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: {'hp': 20, 'gold': 50},
        maxResources: {'hp': 20},
        inventory: [
          GameItem(
            id: 'iron_sword',
            name: 'شمشیر آهنی',
            description: '',
            type: 'weapon',
            quantity: 1,
          ),
        ],
      );

      final newPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: {'hp': 20, 'gold': 50},
        maxResources: {'hp': 20},
        inventory: [
          GameItem(
            id: 'iron_sword',
            name: 'شمشیر آهنی',
            description: '',
            type: 'weapon',
            quantity: 1,
          ),
        ],
      );

      final delta = TurnStatusDelta.compute(
        oldState: oldPlayer,
        newState: newPlayer,
        isPersian: true,
      );

      expect(delta, isNull);
    });

    test('detects damage and health loss correctly', () {
      final oldPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: {'hp': 20},
        maxResources: {'hp': 20},
        inventory: const [],
      );

      final newPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: {'hp': 14},
        maxResources: {'hp': 20},
        inventory: const [],
      );

      final delta = TurnStatusDelta.compute(
        oldState: oldPlayer,
        newState: newPlayer,
        isPersian: true,
      );

      expect(delta, isNotNull);
      expect(delta!.hasChanges, isTrue);
      expect(delta.items.length, 1);
      final hpItem = delta.items.first;
      expect(hpItem.type, StatusDeltaType.healthLoss);
      expect(hpItem.delta, -6);
      expect(hpItem.isNegative, isTrue);
      expect(hpItem.subtitle, '14 / 20');
      expect(hpItem.color, const Color(0xFFEF4444));
    });

    test('detects healing and currency gains correctly', () {
      final oldPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: {'hp': 10, 'gold': 20},
        maxResources: {'hp': 20},
        inventory: const [],
      );

      final newPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: {'hp': 16, 'gold': 35},
        maxResources: {'hp': 20},
        inventory: const [],
      );

      final delta = TurnStatusDelta.compute(
        oldState: oldPlayer,
        newState: newPlayer,
        isPersian: true,
      );

      expect(delta, isNotNull);
      expect(delta!.items.length, 2);

      final hpItem = delta.items.firstWhere((i) => i.type == StatusDeltaType.healthGain);
      expect(hpItem.delta, 6);
      expect(hpItem.subtitle, '16 / 20');

      final goldItem = delta.items.firstWhere((i) => i.type == StatusDeltaType.currencyGain);
      expect(goldItem.delta, 15);
      expect(goldItem.subtitle, '35');
    });

    test('detects item acquisition and loss in inventory', () {
      final oldPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: const {},
        inventory: [
          GameItem(
            id: 'torch',
            name: 'مشعل',
            description: '',
            type: 'consumable',
            quantity: 2,
          ),
        ],
      );

      final newPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: const {},
        inventory: [
          GameItem(
            id: 'torch',
            name: 'مشعل',
            description: '',
            type: 'consumable',
            quantity: 1,
          ),
          GameItem(
            id: 'dagger',
            name: 'خنجر نقره‌ای',
            description: '',
            type: 'weapon',
            quantity: 1,
          ),
        ],
      );

      final delta = TurnStatusDelta.compute(
        oldState: oldPlayer,
        newState: newPlayer,
        isPersian: true,
      );

      expect(delta, isNotNull);
      final acquired = delta!.items.firstWhere((i) => i.type == StatusDeltaType.itemAcquired);
      expect(acquired.label, 'خنجر نقره‌ای');
      expect(acquired.delta, 1);

      final lost = delta.items.firstWhere((i) => i.type == StatusDeltaType.itemLost);
      expect(lost.label, 'مشعل');
      expect(lost.delta, -1);
    });

    test('detects XP awards and level-up milestones', () {
      final oldPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: const {},
        inventory: const [],
        level: 1,
      );
      final newPlayer = PlayerState(
        currentLocationId: 'loc_1',
        stats: const {},
        resources: const {},
        inventory: const [],
        level: 2,
      );

      final xpAward = ProgressionAward(
        xpGained: 50,
        levelUpOccurred: true,
        newLevel: 2,
      );

      final delta = TurnStatusDelta.compute(
        oldState: oldPlayer,
        newState: newPlayer,
        isPersian: true,
        xpAward: xpAward,
      );

      expect(delta, isNotNull);
      final lvlItem = delta!.items.firstWhere((i) => i.type == StatusDeltaType.levelUp);
      expect(lvlItem.label, contains('۲'));
      expect(lvlItem.color, const Color(0xFFF59E0B));
    });
  });

  group('TurnStatusDeltaBanner Widget Tests', () {
    testWidgets('renders illuminated delta banner with items', (tester) async {
      final delta = TurnStatusDelta(
        items: [
          const StatusDeltaItem(
            type: StatusDeltaType.healthLoss,
            label: 'سلامت (HP)',
            delta: -4,
            subtitle: '16 / 20',
            icon: Icons.heart_broken_rounded,
            color: Color(0xFFEF4444),
          ),
          const StatusDeltaItem(
            type: StatusDeltaType.currencyGain,
            label: 'سکه طلا',
            delta: 15,
            subtitle: '85',
            icon: Icons.monetization_on_rounded,
            color: Color(0xFFF59E0B),
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TurnStatusDeltaBanner(
              delta: delta,
              theme: RealmTheme.darkFantasy,
              isPersian: true,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('پیامدهای نوبت و تغییرات وضعیت'), findsOneWidget);
      expect(find.text('سلامت (HP)'), findsOneWidget);
      expect(find.text('سکه طلا'), findsOneWidget);
      expect(find.byIcon(Icons.heart_broken_rounded), findsOneWidget);
      expect(find.byIcon(Icons.monetization_on_rounded), findsOneWidget);
    });

    testWidgets('can be dismissed via close icon', (tester) async {
      var dismissed = false;
      final delta = TurnStatusDelta(
        items: [
          const StatusDeltaItem(
            type: StatusDeltaType.currencyGain,
            label: 'سکه طلا',
            delta: 10,
            icon: Icons.monetization_on_rounded,
            color: Color(0xFFF59E0B),
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TurnStatusDeltaBanner(
              delta: delta,
              theme: RealmTheme.darkFantasy,
              isPersian: true,
              onDismiss: () => dismissed = true,
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('پیامدهای نوبت و تغییرات وضعیت'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();

      expect(dismissed, isTrue);
      expect(find.text('پیامدهای نوبت و تغییرات وضعیت'), findsNothing);
    });
  });
}
