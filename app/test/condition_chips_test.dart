import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/ui/widgets/condition_chips.dart';

PlayerState _makePlayer({
  String locationId = 'loc_a',
  Map<String, int>? resources,
  List<String> conditions = const [],
}) {
  return PlayerState(
    characterName: 'آرش',
    stats: const {'might': 12},
    resources: resources ?? const {'hp': 100, 'stamina': 50},
    maxResources: const {'hp': 100, 'stamina': 50},
    inventory: const [],
    currentLocationId: locationId,
    conditions: conditions,
  );
}

Future<void> _pumpBar(
  WidgetTester tester, {
  List<String> conditions = const [],
  PlayerState? playerState,
  String? locationName,
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
            locationName: locationName,
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
  });
}
