import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/dice_overlay_provider.dart';
import 'providers/game_session_provider.dart';
import 'ui/screens/auth_screen.dart';
import 'ui/screens/story_catalog_screen.dart';
import 'ui/widgets/dice_roll_overlay.dart';

void main() {
  runApp(
    const ProviderScope(
      child: StoryForgeApp(),
    ),
  );
}

class StoryForgeApp extends ConsumerWidget {
  const StoryForgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diceState = ref.watch(diceOverlayProvider);
    final authState = ref.watch(authProvider);

    Widget homeWidget;
    if (authState.isLoading) {
      homeWidget = const Scaffold(
        backgroundColor: Color(0xFF090A12),
        body: Center(
          child: CircularProgressIndicator(
            color: Color(0xFFF59E0B),
          ),
        ),
      );
    } else if (!authState.isAuthenticated) {
      homeWidget = const AuthScreen(isFullScreen: true);
    } else {
      homeWidget = const StoryCatalogScreen();
    }

    return MaterialApp(
      title: 'افسانه‌ساز (AfsanehSaz)',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkVoid,
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
                resolution: diceState.resolution,
                actionText: diceState.actionText,
                isPersian: diceState.isPersian,
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
      home: homeWidget,
    );
  }
}
