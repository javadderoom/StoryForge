import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/core/engine/rpg_engine.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/models/story.dart';

void main() {
  group('RpgEngine Dynamic Baseline Tests', () {
    test('calculates correct modifiers for standard D&D baseValue 10', () {
      expect(RpgEngine.getStatModifier(10), 0);
      expect(RpgEngine.getStatModifier(11), 0);
      expect(RpgEngine.getStatModifier(12), 1);
      expect(RpgEngine.getStatModifier(14), 2);
      expect(RpgEngine.getStatModifier(8), -1);
      expect(RpgEngine.getStatModifier(6), -2);
    });

    test('calculates correct modifiers dynamically for custom baseValue 3', () {
      expect(RpgEngine.getStatModifier(3, 3), 0);
      expect(RpgEngine.getStatModifier(4, 3), 0);
      expect(RpgEngine.getStatModifier(5, 3), 1);
      expect(RpgEngine.getStatModifier(7, 3), 2);
      expect(RpgEngine.getStatModifier(2, 3), -1);
      expect(RpgEngine.getStatModifier(1, 3), -1);
    });

    test('resolveActionCheck does not penalize characters at baseline', () {
      final statsConfig = [
        const StoryStatSummary(id: 'might', name: 'Might', description: '', baseValue: 3),
        const StoryStatSummary(id: 'agility', name: 'Agility', description: '', baseValue: 3),
      ];
      final playerState = PlayerState(
        stats: {'might': 3, 'agility': 5},
        resources: {'hp': 100},
        inventory: [],
        equipment: const PlayerEquipment(),
        discoveredLocationIds: [],
        relationships: {},
        activeQuestIds: [],
        completedQuestIds: [],
        currentLocationId: 'loc_start',
      );

      final resBaseline = RpgEngine.resolveActionCheck(
        actionText: 'Bash the heavy door with force',
        playerState: playerState,
        requiredStatId: 'might',
        forcedDiceRoll: 10,
        targetDC: 10,
        statsConfig: statsConfig,
      );
      expect(resBaseline.statModifier, 0);
      expect(resBaseline.totalScore, 10);
      expect(resBaseline.outcome, 'success');

      final resAbove = RpgEngine.resolveActionCheck(
        actionText: 'Dodge the dart trap',
        playerState: playerState,
        requiredStatId: 'agility',
        forcedDiceRoll: 10,
        targetDC: 11,
        statsConfig: statsConfig,
      );
      expect(resAbove.statModifier, 1);
      expect(resAbove.totalScore, 11);
      expect(resAbove.outcome, 'success');
    });
  });
}
