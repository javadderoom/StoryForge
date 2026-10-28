import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/ui/widgets/condition_chips.dart';

PlayerState _makePlayer({
  String locationId = 'loc_a',
  Map<String, int>? resources,
  List<String> conditions = const [],
  ActiveTravel? travel,
}) {
  return PlayerState(
    characterName: 'آرش',
    stats: const {'might': 12},
    resources: resources ?? const {'hp': 100, 'stamina': 50},
    maxResources: const {'hp': 100, 'stamina': 50},
    inventory: const [],
    currentLocationId: locationId,
    conditions: conditions,
    travel: travel,
  );
}

Future<void> _pumpBar(
  WidgetTester tester, {
  List<String> conditions = const [],
  PlayerState? playerState,
  Map<String, dynamic>? lore,
  String? locationName,
  int? turnNumber,
  bool isPersian = true,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Directionality(
          textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
          child: VitalityPresenceBar(
            conditions: conditions,
            playerState: playerState,
            lore: lore,
            locationName: locationName,
            turnNumber: turnNumber,
            isPersian: isPersian,
          ),
        ),
      ),
    ),
  );
}

void main() {
  group('Plan 17 VitalityPresenceBar — server truth only', () {
    testWidgets('renders exactly the conditions the server sent (no invented baselines)',
        (tester) async {
      final player = _makePlayer(conditions: ['زخمی']);
      await _pumpBar(tester, playerState: player);

      expect(find.text('جراحت خونین'), findsOneWidget);
      // A healthy vitals profile must never fabricate chips.
      expect(find.text('تندرست و قبراق'), findsNothing);
      expect(find.text('پایدار و سرپا'), findsNothing);
      expect(find.text('هوشیار و مراقب'), findsNothing);
      expect(find.text('غریبه در اقلیم'), findsNothing);
    });

    testWidgets('renders a treated wound as a bandage chip', (tester) async {
      await _pumpBar(tester, conditions: ['زخمی (پانسمان‌شده)']);

      expect(find.textContaining('پانسمان‌شده'), findsOneWidget);
      // The alarming untreated chip must not appear.
      expect(find.text('جراحت خونین'), findsNothing);
      expect(find.byIcon(Icons.healing_rounded), findsOneWidget);
    });

    testWidgets('renders custom tags raw with the neutral chip', (tester) async {
      await _pumpBar(tester, conditions: ['اثر رونیک']);

      expect(find.text('اثر رونیک'), findsOneWidget);
      expect(find.byIcon(Icons.tag_outlined), findsOneWidget);
    });

    testWidgets('shows a baseline chip only when the server sent one', (tester) async {
      await _pumpBar(tester, conditions: ['تندرست']);
      expect(find.text('تندرست و قبراق'), findsOneWidget);
    });

    testWidgets('renders nothing when both location and conditions are empty', (tester) async {
      await _pumpBar(tester, conditions: const []);
      expect(find.byType(VitalityPresenceBar), findsOneWidget);
      expect(find.byIcon(Icons.tag_outlined), findsNothing);
      expect(find.byIcon(Icons.healing_rounded), findsNothing);
    });

    testWidgets('still renders the location badge without conditions', (tester) async {
      await _pumpBar(tester, conditions: const [], locationName: 'دروازه نمک');
      expect(find.text('دروازه نمک'), findsOneWidget);
    });

    testWidgets('bleeding renders with its canonical chip', (tester) async {
      await _pumpBar(tester, conditions: ['خون‌ریزی']);
      expect(find.text('خون‌ریزی'), findsOneWidget);
    });

    testWidgets('renders travel badge first before location and conditions', (tester) async {
      final travel = ActiveTravel(
        originLocationId: 'loc_a',
        destinationLocationId: 'loc_citadel',
        departedTurn: 1,
        totalTurns: 3,
      );
      final player = _makePlayer(
        conditions: ['هوشیار'],
        travel: travel,
      );
      final lore = {
        'locations': [
          {'id': 'loc_a', 'name': 'دروازه سرخ'},
          {'id': 'loc_citadel', 'name': 'ارگ سنگخورشید'},
        ]
      };

      await _pumpBar(
        tester,
        playerState: player,
        lore: lore,
        locationName: 'دروازه سرخ',
        turnNumber: 2,
      );

      // Travel badge rendered with destination without turn countdown
      expect(find.text('در راه «ارگ سنگخورشید»'), findsOneWidget);
      expect(find.textContaining('نوبت مانده'), findsNothing);
      expect(find.text('دروازه سرخ'), findsOneWidget);
      expect(find.text('هوشیار و مراقب'), findsOneWidget);
    });

    testWidgets('renders travel badge with distance and without turn countdown', (tester) async {
      final travel = ActiveTravel(
        originLocationId: 'loc_a',
        destinationLocationId: 'loc_citadel',
        departedTurn: 5,
        totalTurns: 4,
        distanceKm: 120,
      );
      final player = _makePlayer(travel: travel);
      final lore = {
        'locations': [
          {'id': 'loc_citadel', 'name': 'Sunstone Citadel'},
        ]
      };

      await _pumpBar(
        tester,
        playerState: player,
        lore: lore,
        turnNumber: 8,
        isPersian: false,
      );

      expect(find.text('En route to "Sunstone Citadel" (\u200E120 km)'), findsOneWidget);
      expect(find.textContaining('turns left'), findsNothing);
    });
  });
}
