import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'providers/dice_overlay_provider.dart';
import 'providers/game_session_provider.dart';
import 'services/deep_link_service.dart';
import 'ui/screens/splash_screen.dart';
import 'ui/widgets/dice_roll_overlay.dart';
import 'ui/widgets/reset_password_dialog.dart';

final GlobalKey<NavigatorState> rootNavigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  runApp(
    const ProviderScope(
      child: AfsanehSazApp(),
    ),
  );
}

class AfsanehSazApp extends ConsumerStatefulWidget {
  const AfsanehSazApp({super.key});

  @override
  ConsumerState<AfsanehSazApp> createState() => _AfsanehSazAppState();
}

class _AfsanehSazAppState extends ConsumerState<AfsanehSazApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initDeepLinks();
    });
  }

  void _initDeepLinks() {
    DeepLinkService.init(
      onUriReceived: (uri) {
        _handleIncomingUri(uri);
      },
    );
  }

  void _handleIncomingUri(Uri uri) {
    debugPrint('[DeepLink] Incoming URI received: $uri');
    final isResetPassword = uri.path.contains('reset-password') || uri.host == 'reset-password';
    final token = uri.queryParameters['token'];

    if (isResetPassword && token != null && token.isNotEmpty) {
      _showResetPasswordDialog(token);
    }
  }

  void _showResetPasswordDialog(String token) {
    void present() {
      final ctx = rootNavigatorKey.currentContext;
      if (ctx != null) {
        ResetPasswordDialog.show(ctx, token: token);
      }
    }

    final immediateCtx = rootNavigatorKey.currentContext;
    if (immediateCtx != null) {
      present();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        present();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final diceState = ref.watch(diceOverlayProvider);

    // Feed the dice overlay the SERVER's authoritative resolution as soon as
    // the turn resolves, or report errors if the turn fails.
    ref.listen<GameSessionState>(gameSessionProvider, (prev, next) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (next.errorMessage != null && next.errorMessage != prev?.errorMessage) {
          ref.read(diceOverlayProvider.notifier).reportError(next.errorMessage!);
        }
        final resolution = next.lastResolution;
        if (resolution == null) return;
        if (prev != null && identical(prev.lastResolution, resolution)) return;
        ref.read(diceOverlayProvider.notifier).applyServerResolution(resolution);
      });
    });

    return MaterialApp(
      navigatorKey: rootNavigatorKey,
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
                resolution: diceState.resolution,
                serverResolution: diceState.serverResolution,
                awaitingReferee: diceState.awaitingReferee,
                actionText: diceState.actionText,
                isPersian: diceState.isPersian,
                statsConfig: diceState.statsConfig,
                errorMessage: diceState.errorMessage,
                isRecalling: diceState.isRecalling,
                onRollComplete: () {
                  ref.read(diceOverlayProvider.notifier).finishRoll();
                },
                onRecall: diceState.onRecall,
                onDismiss: () {
                  ref.read(diceOverlayProvider.notifier).hide();
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
