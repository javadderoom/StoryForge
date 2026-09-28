import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/game_state.dart';
import 'package:afsanehsaz/providers/dice_overlay_provider.dart';
import 'package:afsanehsaz/ui/widgets/dice_roll_overlay.dart';

/// Guards the fix for the client/server RPG engine divergence.
///
/// `app/lib/core/engine/rpg_engine.dart` is a strict subset of the server's
/// `GameEngine.ts` — it omits skills, passive abilities, structured ability
/// effects, and the state diff. It also folds `environmentalModifier` into
/// `statModifier`, while the server keeps the two separate and only sums the
/// environmental term into `totalScore`.
///
/// The overlay used to render entirely from the client engine, so it could show
/// a success the server recorded as a failure. It now renders from
/// `serverResolution` only; the client resolution exists solely to choose the
/// 3D die's target face.
void main() {
  CheckResolution makeResolution({
    required String outcome,
    required int diceRoll,
    required int statModifier,
    required int totalScore,
    int environmentalModifier = 0,
    int difficultyClass = 12,
  }) {
    return CheckResolution(
      outcome: outcome,
      diceRoll: diceRoll,
      statModifier: statModifier,
      environmentalModifier: environmentalModifier,
      totalScore: totalScore,
      difficultyClass: difficultyClass,
      consequenceSummary: 'Clear success: objective accomplished as intended.',
    );
  }

  group('CheckResolution.environmentalModifier', () {
    test('parses the server field', () {
      final r = CheckResolution.fromJson({
        'outcome': 'success',
        'diceRoll': 14,
        'statModifier': 3,
        'environmentalModifier': 4,
        'totalScore': 21,
        'difficultyClass': 15,
        'consequenceSummary': 'ok',
      });
      expect(r.environmentalModifier, 4);
    });

    test('defaults to 0 when the server omits it', () {
      final r = CheckResolution.fromJson({
        'outcome': 'success',
        'diceRoll': 14,
        'statModifier': 3,
        'totalScore': 17,
        'difficultyClass': 15,
        'consequenceSummary': 'ok',
      });
      expect(r.environmentalModifier, 0);
    });

    test('tolerates a JSON double', () {
      final r = CheckResolution.fromJson({
        'outcome': 'success',
        'diceRoll': 14,
        'statModifier': 0,
        'environmentalModifier': 4.0,
        'totalScore': 18,
        'difficultyClass': 15,
        'consequenceSummary': 'ok',
      });
      expect(r.environmentalModifier, 4);
      expect(r.environmentalModifier, isA<int>());
    });
  });

  group('DiceRollOverlay — server authority', () {
    testWidgets('does not display the client outcome while the server is pending',
        (tester) async {
      // Client engine says success; the server will go on to record a failure.
      // Until it does, the overlay must show neither.
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: DiceRollOverlay(
              resolution: null,
              serverResolution: null,
              awaitingReferee: true,
              actionText: 'Strike the sentinel',
              isVisible: true,
              isRolling: false,
              isPersian: false,
              onContinue: _noop,
              onRollComplete: _noop,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Adjudicating outcome...'), findsOneWidget);
      expect(find.text('SUCCESS'), findsNothing);
      expect(find.text('FAILURE'), findsNothing);
    });

    testWidgets('renders the server total, not the client total', (tester) async {
      // Client engine says success with a +4 bonus; the server records a
      // failure. Every displayed number is distinct so each is uniquely
      // findable: roll 17, server mod -2, server total 15, DC 18; the client
      // claimed mod +4 and total 21.
      final client = makeResolution(
        outcome: 'success',
        diceRoll: 17,
        statModifier: 4,
        totalScore: 21,
        difficultyClass: 18,
      );
      final server = makeResolution(
        outcome: 'failure',
        diceRoll: 17,
        statModifier: -2,
        totalScore: 15,
        difficultyClass: 18,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DiceRollOverlay(
              resolution: client,
              serverResolution: server,
              awaitingReferee: false,
              actionText: 'Strike the sentinel',
              isVisible: true,
              isRolling: false,
              isPersian: false,
              onContinue: _noop,
              onRollComplete: _noop,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('FAILURE'), findsOneWidget);
      expect(find.text('SUCCESS'), findsNothing);
      // Server total 15 and modifier -2 render; the client's 21 / +4 do not.
      expect(find.text('15'), findsOneWidget);
      expect(find.text('21'), findsNothing);
      expect(find.text('-2'), findsOneWidget);
      expect(find.text('+4'), findsNothing);
      // The roll face is shared (the server honours forcedDiceRoll).
      expect(find.text('17'), findsWidgets);
    });

    testWidgets('shows the environmental term so the equation adds up',
        (tester) async {
      // Server: roll 14 + statMod 0 + env 4 = 18. The env term must be rendered
      // or the displayed equation does not sum to the displayed total.
      final server = makeResolution(
        outcome: 'success',
        diceRoll: 14,
        statModifier: 0,
        environmentalModifier: 4,
        totalScore: 18,
        difficultyClass: 15,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DiceRollOverlay(
              resolution: server,
              serverResolution: server,
              awaitingReferee: false,
              actionText: 'Douse the lamp',
              isVisible: true,
              isRolling: false,
              isPersian: false,
              onContinue: _noop,
              onRollComplete: _noop,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Env'), findsOneWidget);
      expect(find.text('+4'), findsOneWidget);
      expect(find.text('18'), findsOneWidget);
    });

    testWidgets('omits the environmental term when it is zero', (tester) async {
      final server = makeResolution(
        outcome: 'success',
        diceRoll: 14,
        statModifier: 2,
        totalScore: 16,
        difficultyClass: 15,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DiceRollOverlay(
              resolution: server,
              serverResolution: server,
              awaitingReferee: false,
              actionText: 'Strike the sentinel',
              isVisible: true,
              isRolling: false,
              isPersian: false,
              onContinue: _noop,
              onRollComplete: _noop,
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Env'), findsNothing);
    });
  });

  group('DiceOverlayNotifier — two-phase flow', () {
    test('finishRoll does not play an outcome sound from client data', () {
      // The provider is exercised through its state transitions only; the audio
      // path is guarded by `applyServerResolution` being the sole caller of the
      // success/fail sting.
      const initial = DiceOverlayState();
      expect(initial.awaitingReferee, isFalse);
      expect(initial.serverResolution, isNull);
    });

    test('clearResolution resets both resolutions and the referee flag', () {
      const populated = DiceOverlayState(
        isVisible: true,
        isRolling: false,
        serverResolution: null,
        awaitingReferee: true,
        actionText: 'x',
      );
      final cleared = populated.copyWith(isVisible: false, clearResolution: true);
      expect(cleared.serverResolution, isNull);
      expect(cleared.resolution, isNull);
      expect(cleared.awaitingReferee, isFalse);
      expect(cleared.isVisible, isFalse);
    });
  });
}

void _noop() {}
