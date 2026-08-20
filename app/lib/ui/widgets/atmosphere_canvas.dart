import 'dart:math';
import 'package:flutter/material.dart';
import '../../core/theme/realm_theme.dart';

class AtmosphereCanvas extends StatefulWidget {
  final RealmTheme theme;
  final bool isDanger;
  final bool enableParticles;
  final Widget child;

  const AtmosphereCanvas({
    super.key,
    required this.theme,
    this.isDanger = false,
    this.enableParticles = true,
    required this.child,
  });

  @override
  State<AtmosphereCanvas> createState() => _AtmosphereCanvasState();
}

class _AtmosphereCanvasState extends State<AtmosphereCanvas>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  final List<_Particle> _particles = [];
  final Random _random = Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    );

    _initParticles();

    if (widget.enableParticles) {
      _controller.repeat();
    }
  }

  void _initParticles() {
    _particles.clear();
    final count = widget.theme.particleDensity.toInt();
    for (int i = 0; i < count; i++) {
      _particles.add(_Particle.random(_random, widget.theme));
    }
  }

  @override
  void didUpdateWidget(covariant AtmosphereCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.theme.preset != widget.theme.preset) {
      _initParticles();
    }
    if (oldWidget.enableParticles != widget.enableParticles) {
      if (widget.enableParticles) {
        if (!_controller.isAnimating) {
          _controller.repeat();
        }
      } else {
        _controller.stop();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 500),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            widget.theme.bgGradientStart,
            widget.theme.bgGradientEnd,
          ],
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // High-performance particle physics layer driven by repaint notifier
          if (widget.enableParticles)
            RepaintBoundary(
              child: IgnorePointer(
                child: CustomPaint(
                  painter: _AtmospherePainter(
                    repaint: _controller,
                    particles: _particles,
                    theme: widget.theme,
                    isDanger: widget.isDanger,
                  ),
                ),
              ),
            ),

          // Main child content in isolated repaint boundary
          RepaintBoundary(
            child: widget.child,
          ),
        ],
      ),
    );
  }
}

class _Particle {
  double x;
  double y;
  double size;
  double speedY;
  double driftX;
  double phase;
  double opacity;
  Color color;

  _Particle({
    required this.x,
    required this.y,
    required this.size,
    required this.speedY,
    required this.driftX,
    required this.phase,
    required this.opacity,
    required this.color,
  });

  factory _Particle.random(Random rand, RealmTheme theme) {
    final color = theme.particleColors[rand.nextInt(theme.particleColors.length)];
    return _Particle(
      x: rand.nextDouble(),
      y: rand.nextDouble(),
      size: rand.nextDouble() * 3.2 + 1.2,
      speedY: (rand.nextDouble() * 0.0008 + 0.0003) * theme.particleSpeed,
      driftX: (rand.nextDouble() - 0.5) * 0.0006,
      phase: rand.nextDouble() * 2 * pi,
      opacity: rand.nextDouble() * 0.6 + 0.2,
      color: color,
    );
  }

  void update(Random rand, RealmTheme theme) {
    y -= speedY;
    phase += 0.03;
    x += sin(phase) * 0.0008 + driftX;

    if (y < -0.05) {
      y = 1.05;
      x = rand.nextDouble();
      color = theme.particleColors[rand.nextInt(theme.particleColors.length)];
      opacity = rand.nextDouble() * 0.6 + 0.2;
    }
    if (x < -0.05) x = 1.05;
    if (x > 1.05) x = -0.05;
  }
}

class _AtmospherePainter extends CustomPainter {
  final List<_Particle> particles;
  final RealmTheme theme;
  final bool isDanger;
  final Random _rand = Random();
  final Paint _particlePaint = Paint()..style = PaintingStyle.fill;

  _AtmospherePainter({
    required super.repaint,
    required this.particles,
    required this.theme,
    required this.isDanger,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width == 0 || size.height == 0) return;

    for (final p in particles) {
      p.update(_rand, theme);

      final px = p.x * size.width;
      final py = p.y * size.height;

      // Soft outer glow halo
      _particlePaint.color = p.color.withValues(alpha: p.opacity * 0.35);
      canvas.drawCircle(Offset(px, py), p.size * 2.0, _particlePaint);

      // Core particle
      _particlePaint.color = p.color.withValues(alpha: p.opacity);
      canvas.drawCircle(Offset(px, py), p.size, _particlePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _AtmospherePainter oldDelegate) => true;
}
