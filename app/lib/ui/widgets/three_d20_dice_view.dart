import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Exact 3D d20.glb Model View for StoryForge (Flutter)
/// Renders the exact Three.js 3D GLB model with offline shaders,
/// gold numeral materials, RoomEnvironment reflections, and calibrated landing physics.
class ThreeD20DiceView extends StatefulWidget {
  final int resultNumber;
  final bool isRolling;
  final VoidCallback? onRollComplete;
  final double size;

  const ThreeD20DiceView({
    super.key,
    required this.resultNumber,
    required this.isRolling,
    this.onRollComplete,
    this.size = 180,
  });

  @override
  State<ThreeD20DiceView> createState() => ThreeD20DiceViewState();
}

class ThreeD20DiceViewState extends State<ThreeD20DiceView> {
  late final WebViewController _controller;
  bool _isModelLoaded = false;

  void roll(int targetNum) {
    _controller.runJavaScript('if (window.rollDice) window.rollDice($targetNum);');
  }

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel(
        'RollChannel',
        onMessageReceived: (JavaScriptMessage message) {
          if (message.message == 'loaded') {
            if (mounted) {
              setState(() {
                _isModelLoaded = true;
              });
              if (widget.isRolling) {
                _triggerRoll(widget.resultNumber);
              } else {
                _controller.runJavaScript(
                  'if (window.setTargetNumber) window.setTargetNumber(${widget.resultNumber});',
                );
              }
            }
          } else if (message.message == 'settled') {
            if (mounted) {
              widget.onRollComplete?.call();
            }
          }
        },
      );

    _controller.loadFlutterAsset('assets/d20_3d/index.html');
  }

  void _triggerRoll(int targetNum) {
    _controller.runJavaScript('if (window.rollDice) window.rollDice($targetNum);');
  }

  @override
  void didUpdateWidget(covariant ThreeD20DiceView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isRolling && (!oldWidget.isRolling || widget.resultNumber != oldWidget.resultNumber)) {
      _triggerRoll(widget.resultNumber);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Synchronously attached native view for reliable loading every roll
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AnimatedOpacity(
              opacity: _isModelLoaded ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 150),
              child: WebViewWidget(controller: _controller),
            ),
          ),
          if (!_isModelLoaded)
            Container(
              width: widget.size * 0.7,
              height: widget.size * 0.7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
              ),
              child: const Center(
                child: Icon(
                  Icons.casino_outlined,
                  color: Color(0xFFF59E0B),
                  size: 48,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
