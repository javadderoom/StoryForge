import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';

void main() {
  group('Plan 17 ActiveTravel state', () {
    test('round-trips through PlayerState JSON', () {
      final player = PlayerState(
        stats: const {'might': 12},
        resources: const {'hp': 80, 'stamina': 40},
        maxResources: const {'hp': 100, 'stamina': 50},
        inventory: const [],
        currentLocationId: 'loc_caravansary',
        travel: const ActiveTravel(
          originLocationId: 'loc_caravansary',
          destinationLocationId: 'loc_citadel',
          routeId: 'route_silk',
          waypointIds: ['loc_oasis', 'loc_pass'],
          mode: 'caravan',
          departedTurn: 12,
          totalTurns: 4,
          caravanNpcIds: ['npc_master'],
        ),
      );

      final json = player.toJson();
      final restored = PlayerState.fromJson(json);

      expect(restored.travel, isNotNull);
      expect(restored.travel!.destinationLocationId, 'loc_citadel');
      expect(restored.travel!.routeId, 'route_silk');
      expect(restored.travel!.waypointIds, ['loc_oasis', 'loc_pass']);
      expect(restored.travel!.mode, 'caravan');
      expect(restored.travel!.departedTurn, 12);
      expect(restored.travel!.totalTurns, 4);
      expect(restored.travel!.caravanNpcIds, ['npc_master']);
    });

    test('legacy payloads without travel parse to null', () {
      final restored = PlayerState.fromJson({
        'stats': {'might': 12},
        'resources': {'hp': 80},
        'inventory': [],
        'currentLocationId': 'loc_a',
      });
      expect(restored.travel, isNull);
      expect(restored.toJson().containsKey('travel'), isFalse);
    });

    test('derived progress is a pure function of the turn number (rewind-safe)', () {
      const travel = ActiveTravel(
        originLocationId: 'loc_a',
        destinationLocationId: 'loc_d',
        waypointIds: ['loc_b', 'loc_c'],
        departedTurn: 10,
        totalTurns: 3,
      );

      expect(travel.turnsRemaining(10), 3);
      expect(travel.currentStopIndex(10), 0);
      expect(travel.turnsRemaining(11), 2);
      expect(travel.currentStopIndex(11), 1);
      expect(travel.turnsRemaining(12), 1);
      expect(travel.currentStopIndex(12), 2);
      expect(travel.turnsRemaining(13), 0);
      // Recomputation at the same turn is idempotent — nothing mutates.
      expect(travel.turnsRemaining(12), 1);
    });
  });
}
