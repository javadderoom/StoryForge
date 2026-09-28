import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'providers/dice_overlay_provider.dart';
import 'providers/game_session_provider.dart';
import 'ui/screens/splash_screen.dart';
import 'ui/widgets/dice_roll_overlay.dart';

void main() {
  runApp(
    const ProviderScope(
      child: AfsanehSazApp(),
    ),
  );
}

class AfsanehSazApp extends ConsumerWidget {
  const AfsanehSazApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diceState = ref.watch(diceOverlayProvider);

    // Feed the dice overlay the SERVER's authoritative resolution as soon as
    // the turn resolves. The client-side RpgEngine is a strict subset of the
    // server GameEngine (no skills, passives, ability effects, or state diff),
    // so it can display an outcome the server never committed. The animation
    // still starts immediately from the client roll — only what the player
    // READS waits for the referee.
    ref.listen<GameSessionState>(gameSessionProvider, (prev, next) {
      final resolution = next.lastResolution;
      if (resolution == null) return;
      if (prev != null && identical(prev.lastResolution, resolution)) return;
      ref.read(diceOverlayProvider.notifier).applyServerResolution(resolution);
    });

    return MaterialApp(
      title: 'افسانه‌ساز',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkVoid,
      home: const SplashScreen(),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: Stack(
            children: [
              child ?? const SizedBox.shrink(),
              // Pre-warmed Root 3D D20 Dice Overlay (Initialized once on app launch)
              DiceRollOverlay(
                isVisible: diceState.isVisible,
                isRolling: diceState.isRolling,
                // Drives only the 3D die's target face.
                resolution: diceState.resolution,
                // Drives every displayed number, label, colour and sound.
                serverResolution: diceState.serverResolution,
                awaitingReferee: diceState.awaitingReferee,
                actionText: diceState.actionText,
                isPersian: diceState.isPersian,
                statsConfig: diceState.statsConfig,
                onRollComplete: () {
                  ref.read(diceOverlayProvider.notifier).finishRoll();
                },
                onContinue: () {
                  final onContinueCb = diceState.onContinue;
                  ref.read(diceOverlayProvider.notifier).hide();
                  if (onContinueCb != null) {
                    onContinueCb();
                  } else {
                    ref.read(gameSessionProvider.notifier).applyPendingTurn();
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
