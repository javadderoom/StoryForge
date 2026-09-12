import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/realm_theme.dart';
import '../../models/choice_option.dart';
import '../../models/story.dart';
import '../../services/audio_service.dart';

class ThreeDChoiceCard extends StatefulWidget {
  final ChoiceOption choice;
  final RealmTheme theme;
  final bool isPersian;
  final List<StoryStatSummary>? statsConfig;
  final VoidCallback onTap;

  const ThreeDChoiceCard({
    super.key,
    required this.choice,
    required this.theme,
    required this.onTap,
    this.isPersian = true,
    this.statsConfig,
  });

  @override
  State<ThreeDChoiceCard> createState() => _ThreeDChoiceCardState();
}

class _ThreeDChoiceCardState extends State<ThreeDChoiceCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _springController;
  late Animation<double> _springAnimX;
  late Animation<double> _springAnimY;

  double _rotX = 0.0;
  double _rotY = 0.0;
  double _lightX = 0.5;
  double _lightY = 0.5;
  bool _isPressed = false;

  @override
  void initState() {
    super.initState();
    _springController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    )..addListener(() {
        setState(() {
          _rotX = _springAnimX.value;
          _rotY = _springAnimY.value;
          _lightX = 0.5 - (_rotY / 0.25) * 0.4;
          _lightY = 0.5 + (_rotX / 0.25) * 0.4;
        });
      });
  }

  @override
  void dispose() {
    _springController.dispose();
    super.dispose();
  }

  void _handlePanUpdate(Offset localPos, Size size) {
    if (size.width == 0 || size.height == 0) return;
    final normX = (localPos.dx / size.width).clamp(0.0, 1.0) - 0.5;
    final normY = (localPos.dy / size.height).clamp(0.0, 1.0) - 0.5;

    setState(() {
      _rotY = normX * 0.22; // max tilt ~12 degrees
      _rotX = -normY * 0.22;
      _lightX = 0.5 - normX * 0.8;
      _lightY = 0.5 - normY * 0.8;
    });
  }

  void _releaseTilt() {
    _springAnimX = Tween<double>(begin: _rotX, end: 0.0).animate(
      CurvedAnimation(parent: _springController, curve: Curves.easeOutBack),
    );
    _springAnimY = Tween<double>(begin: _rotY, end: 0.0).animate(
      CurvedAnimation(parent: _springController, curve: Curves.easeOutBack),
    );
    _springController.forward(from: 0.0);
  }

  String _formatStatName(String statId) {
    final cleanId = statId.toLowerCase().replaceAll(' ', '_');
    if (widget.statsConfig != null && widget.statsConfig!.isNotEmpty) {
      for (final s in widget.statsConfig!) {
        if (s.id.toLowerCase().replaceAll(' ', '_') == cleanId) {
          return s.getLocalizedName(widget.isPersian);
        }
      }
    }
    if (!widget.isPersian) {
      return statId
          .replaceAll('_', ' ')
          .split(' ')
          .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
          .join(' ');
    }
    switch (cleanId) {
      case 'might':
      case 'strength':
        return 'قدرت';
      case 'agility':
      case 'dexterity':
      case 'speed':
        return 'چابکی';
      case 'cunning':
      case 'wit':
        return 'ذکاوت';
      case 'arcana':
      case 'magic':
      case 'sorcery':
        return 'جادو';
      case 'charm':
      case 'charisma':
        return 'جذابیت';
      case 'empathy':
        return 'همدلی';
      case 'passion':
        return 'شور و اشتیاق';
      case 'deduction':
        return 'استنتاج';
      case 'perception':
      case 'observation':
        return 'دقت و بینش';
      case 'hacking':
      case 'tech':
        return 'نفوذ سایبری';
      case 'cyberware':
        return 'افزونه‌های سایبری';
      default:
        return statId.replaceAll('_', ' ');
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onPanDown: (details) {
        HapticFeedback.selectionClick();
        setState(() => _isPressed = true);
        final renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox != null) {
          _handlePanUpdate(details.localPosition, renderBox.size);
        }
      },
      onPanUpdate: (details) {
        final renderBox = context.findRenderObject() as RenderBox?;
        if (renderBox != null) {
          _handlePanUpdate(details.localPosition, renderBox.size);
        }
      },
      onPanCancel: () {
        setState(() => _isPressed = false);
        _releaseTilt();
      },
      onPanEnd: (_) {
        setState(() => _isPressed = false);
        _releaseTilt();
      },
      onTap: () {
        HapticFeedback.mediumImpact();
        AudioService().playSfx(SfxType.buttonClick);
        widget.onTap();
      },
      child: Transform(
        alignment: FractionalOffset.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0014) // 3D perspective focal length
          ..rotateX(_rotX)
          ..rotateY(_rotY)
          ..scaleByDouble(_isPressed ? 0.98 : 1.0, _isPressed ? 0.98 : 1.0, 1.0, 1.0),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              children: [
                // 1. Base Dark Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
                  decoration: BoxDecoration(
                    color: widget.theme.cardBg,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _isPressed
                          ? widget.theme.primaryAccent
                          : widget.theme.cardBorder,
                      width: _isPressed ? 1.5 : 1.1,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (widget.choice.requiredStatId != null &&
                          widget.choice.requiredStatId!.trim().isNotEmpty) ...[
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF60A5FA).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: const Color(0xFF60A5FA).withValues(alpha: 0.3),
                            ),
                          ),
                          child: Text(
                            _formatStatName(widget.choice.requiredStatId!),
                            style: GoogleFonts.vazirmatn(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF60A5FA),
                            ),
                          ),
                        ),
                      ],
                      Text(
                        widget.choice.text,
                        textAlign: TextAlign.start,
                        style: GoogleFonts.vazirmatn(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFFF4F4F5),
                          height: 1.6,
                        ),
                      ),
                    ],
                  ),
                ),

                // 2. Dynamic Specular Light Sheen Layer (Tracks finger tilt in 3D)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        gradient: RadialGradient(
                          center: Alignment(_lightX * 2 - 1, _lightY * 2 - 1),
                          radius: 0.95,
                          colors: [
                            Colors.white.withValues(alpha: _isPressed ? 0.18 : 0.08),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
