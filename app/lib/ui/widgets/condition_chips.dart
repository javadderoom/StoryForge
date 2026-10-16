import 'package:flutter/material.dart';
import '../../models/game_state.dart';
import '../../providers/game_session_provider.dart';

class ConditionMeta {
  final String labelFa;
  final String labelEn;
  final IconData icon;
  final Color accentColor;
  final Color backgroundColor;
  final String tooltipFa;
  final String tooltipEn;

  const ConditionMeta({
    required this.labelFa,
    required this.labelEn,
    required this.icon,
    required this.accentColor,
    required this.backgroundColor,
    required this.tooltipFa,
    required this.tooltipEn,
  });
}

const Map<String, ConditionMeta> _conditionRegistry = {
  // --- Zone 2: Physical Body Conditions ---
  'تشنه': ConditionMeta(
    labelFa: 'تشنه',
    labelEn: 'Parched',
    icon: Icons.water_drop_outlined,
    accentColor: Colors.lightBlueAccent,
    backgroundColor: Color(0xFF0C2A4A),
    tooltipFa: 'کمبود آب و خشکی گلو؛ توان بدنی در گرما تحلیل می‌رود.',
    tooltipEn: 'Dehydration; lack of water drains physical stamina.',
  ),
  'خسته': ConditionMeta(
    labelFa: 'فرسوده',
    labelEn: 'Exhausted',
    icon: Icons.air_rounded,
    accentColor: Colors.amberAccent,
    backgroundColor: Color(0xFF452C06),
    tooltipFa: 'فرسودگی ناشی از راهپیمایی طولانی یا نبرد؛ واکنش‌ها کندتر شده‌اند.',
    tooltipEn: 'Fatigue from prolonged march or combat; reactions are sluggish.',
  ),
  'زخمی': ConditionMeta(
    labelFa: 'جراحت خونین',
    labelEn: 'Wounded',
    icon: Icons.heart_broken_rounded,
    accentColor: Colors.redAccent,
    backgroundColor: Color(0xFF4A0E17),
    tooltipFa: 'جراحت بر تن؛ در صورت درگیری فیزیکی سنگین، توان بیشتری از دست می‌دهید.',
    tooltipEn: 'Severe wound; physical strain incurs extra stamina drain.',
  ),
  'مسموم': ConditionMeta(
    labelFa: 'مسموم',
    labelEn: 'Venomed',
    icon: Icons.science_outlined,
    accentColor: Colors.lightGreenAccent,
    backgroundColor: Color(0xFF1B3D0E),
    tooltipFa: 'سم یا عفونت در خون؛ نیازمند پادزهر یا استراحت عمیق.',
    tooltipEn: 'Venom coursing through blood; requires antitoxin or deep rest.',
  ),
  'تندرست': ConditionMeta(
    labelFa: 'تندرست و قبراق',
    labelEn: 'Vigorous',
    icon: Icons.shield_outlined,
    accentColor: Color(0xFF10B981),
    backgroundColor: Color(0xFF063524),
    tooltipFa: 'تن سالم و توانمند؛ هیچ جراحت یا فرسودگی بازدارنده‌ای در تنتان نیست.',
    tooltipEn: 'Body in prime condition; unencumbered by injury or fatigue.',
  ),
  'پایدار': ConditionMeta(
    labelFa: 'پایدار و سرپا',
    labelEn: 'Stable',
    icon: Icons.health_and_safety_outlined,
    accentColor: Color(0xFF34D399),
    backgroundColor: Color(0xFF0A2E20),
    tooltipFa: 'وضعیت جسمانی پایدار است.',
    tooltipEn: 'Physical vitality is stable.',
  ),

  // --- Zone 3: Mind & Morale Conditions ---
  'هوشیار': ConditionMeta(
    labelFa: 'هوشیار و مراقب',
    labelEn: 'Vigilant',
    icon: Icons.visibility_outlined,
    accentColor: Colors.tealAccent,
    backgroundColor: Color(0xFF09332C),
    tooltipFa: 'حواس جمع و گوش‌به‌زنگ؛ محیط پیرامون را زیر نظر دارید.',
    tooltipEn: 'Alert and watchful; aware of environmental nuances.',
  ),
  'شوک‌زده': ConditionMeta(
    labelFa: 'شوک‌زده و مبهوت',
    labelEn: 'Shaken',
    icon: Icons.bolt_outlined,
    accentColor: Colors.purpleAccent,
    backgroundColor: Color(0xFF3B104A),
    tooltipFa: 'شوک ناشی از حادثه یا فشار شدید؛ حواس نیازمند بازیابی است.',
    tooltipEn: 'Mental shock and elevated tension from recent trauma.',
  ),
  'گیج': ConditionMeta(
    labelFa: 'سرگیجه و گیجی',
    labelEn: 'Dazed',
    icon: Icons.psychology_outlined,
    accentColor: Colors.deepPurpleAccent,
    backgroundColor: Color(0xFF330E40),
    tooltipFa: 'سرگیجه یا شوک؛ تمرکز ذهنی کاهش یافته است.',
    tooltipEn: 'Mental disorientation from shock or blunt trauma.',
  ),
  'ناآشنا': ConditionMeta(
    labelFa: 'غریبه در اقلیم',
    labelEn: 'Outsider',
    icon: Icons.explore_outlined,
    accentColor: Colors.indigoAccent,
    backgroundColor: Color(0xFF1E1E4A),
    tooltipFa: 'ناآشنا به این دیار؛ راه‌ها و رفتار محلی‌ها هنوز مبهم است.',
    tooltipEn: 'Stranger to this realm; local ways and routes are unfamiliar.',
  ),
  'مصمم': ConditionMeta(
    labelFa: 'ارادهٔ پولادین',
    labelEn: 'Resolute',
    icon: Icons.military_tech_outlined,
    accentColor: Color(0xFF60A5FA),
    backgroundColor: Color(0xFF1E3A8A),
    tooltipFa: 'عزم راسخ در برابر سختی‌ها؛ اراده تسلیم‌ناپذیر است.',
    tooltipEn: 'Steely resolve under pressure; unyielding determination.',
  ),
  'مظنون': ConditionMeta(
    labelFa: 'تحت نظر',
    labelEn: 'Suspected',
    icon: Icons.warning_amber_rounded,
    accentColor: Colors.amber,
    backgroundColor: Color(0xFF3D320B),
    tooltipFa: 'تحت سوءظن یا نظارت؛ رفتار مشکوک توجه نگهبانان را برمی‌انگیزد.',
    tooltipEn: 'Under scrutiny by inquisitors or guards; cautious movement required.',
  ),
};

/// Plan 15 (Pillar 4): Living Vitality & Scene Presence Bar
/// Replaces flat condition tags with an atmospheric, glassmorphic header directly
/// above the narrative beat prose. Never empty: auto-derives dynamic baselines for
/// physical Body and mental Mind whenever explicit conditions are absent.
class VitalityPresenceBar extends StatelessWidget {
  final PlayerState? playerState;
  final Map<String, dynamic>? lore;
  final List<String> conditions;
  final bool isPersian;
  final String? locationName;

  const VitalityPresenceBar({
    super.key,
    this.playerState,
    this.lore,
    this.conditions = const [],
    this.isPersian = true,
    this.locationName,
  });

  List<ConditionMeta> _deriveBodyConditions(List<String> rawConditions) {
    final List<ConditionMeta> list = [];
    const bodyKeywords = {'زخمی', 'خسته', 'تشنه', 'مسموم'};
    final woundRegex = RegExp(
      r'injury|wound|bleed|lesion|trauma|lacerat|زخم|جراحت|خونریزی|مجروح',
      caseSensitive: false,
    );

    for (final cond in rawConditions) {
      final key = cond.trim();
      if (bodyKeywords.contains(key)) {
        final meta = _conditionRegistry[key];
        if (meta != null && !list.contains(meta)) list.add(meta);
      } else if (woundRegex.hasMatch(key)) {
        final woundMeta = ConditionMeta(
          labelFa: 'جراحت تن',
          labelEn: 'Wounded',
          icon: Icons.heart_broken_rounded,
          accentColor: Colors.redAccent,
          backgroundColor: const Color(0xFF4A0E17),
          tooltipFa: 'جراحت بر پیکر ($key)؛ نیازمند مداوا یا پانسمان.',
          tooltipEn: 'Physical injury ($key); requires care.',
        );
        if (!list.any((m) => m.accentColor == Colors.redAccent)) list.add(woundMeta);
      }
    }

    if (list.isEmpty) {
      final player = playerState;
      if (player != null) {
        final hp = player.resources['hp'] ?? player.stats['constitution'] ?? 100;
        final maxHp = player.maxFor('hp', 100);
        final hpRatio = maxHp > 0 ? hp / maxHp : 1.0;

        final stamina = player.resources['stamina'] ?? 100;
        final maxStamina = player.maxFor('stamina', 100);
        final staminaRatio = maxStamina > 0 ? stamina / maxStamina : 1.0;

        final hasWaterClock = player.activeTensionClocks.any(
          (c) => c.id.toLowerCase().contains('water') && c.currentSegments >= 2,
        );

        if (hpRatio <= 0.35) {
          list.add(_conditionRegistry['زخمی']!);
        } else if (hasWaterClock) {
          list.add(_conditionRegistry['تشنه']!);
        } else if (staminaRatio <= 0.25) {
          list.add(_conditionRegistry['خسته']!);
        } else if (hpRatio >= 0.75 && staminaRatio >= 0.6) {
          list.add(_conditionRegistry['تندرست']!);
        } else {
          list.add(_conditionRegistry['پایدار']!);
        }
      } else {
        list.add(_conditionRegistry['پایدار']!);
      }
    }

    return list;
  }

  List<ConditionMeta> _deriveMindConditions(List<String> rawConditions) {
    final List<ConditionMeta> list = [];
    const mindKeywords = {'هوشیار', 'شوک‌زده', 'گیج', 'ناآشنا', 'مصمم'};
    final shockRegex = RegExp(
      r'shock|dazed|terror|fear|panic|شوک|وحشت|ترس',
      caseSensitive: false,
    );

    for (final cond in rawConditions) {
      final key = cond.trim();
      if (mindKeywords.contains(key)) {
        final meta = _conditionRegistry[key];
        if (meta != null && !list.contains(meta)) list.add(meta);
      } else if (shockRegex.hasMatch(key)) {
        final shockMeta = ConditionMeta(
          labelFa: 'شوک‌زده',
          labelEn: 'Shaken',
          icon: Icons.bolt_outlined,
          accentColor: Colors.purpleAccent,
          backgroundColor: const Color(0xFF3B104A),
          tooltipFa: 'شوک و اضطراب ناشی از فشار رویدادها ($key).',
          tooltipEn: 'Mental shock and elevated tension from recent trauma ($key).',
        );
        if (!list.any((m) => m.icon == Icons.bolt_outlined)) list.add(shockMeta);
      }
    }

    if (list.isEmpty) {
      final player = playerState;
      if (player != null) {
        final discoveredCount = player.discoveredLocationIds.length;
        final hp = player.resources['hp'] ?? 100;
        final maxHp = player.maxFor('hp', 100);
        final hpRatio = maxHp > 0 ? hp / maxHp : 1.0;

        if (discoveredCount <= 1) {
          list.add(_conditionRegistry['ناآشنا']!);
        } else if (hpRatio <= 0.3) {
          list.add(_conditionRegistry['شوک‌زده']!);
        } else {
          list.add(_conditionRegistry['هوشیار']!);
        }
      } else {
        list.add(_conditionRegistry['هوشیار']!);
      }
    }

    return list;
  }

  List<String> _extractOtherConditions(List<String> rawConditions) {
    const knownKeys = {
      'تشنه', 'خسته', 'زخمی', 'مسموم', 'تندرست', 'پایدار',
      'هوشیار', 'شوک‌زده', 'گیج', 'ناآشنا', 'مصمم',
    };
    final filterRegex = RegExp(
      r'injury|wound|bleed|lesion|trauma|lacerat|زخم|جراحت|خونریزی|مجروح|shock|dazed|terror|fear|panic|شوک|وحشت|ترس',
      caseSensitive: false,
    );

    return rawConditions
        .where((c) => !knownKeys.contains(c.trim()) && !filterRegex.hasMatch(c))
        .toList();
  }

  Widget _buildLocationBadge(BuildContext context, String locationText) {
    final tooltipMsg = isPersian ? 'موقعیت مکانی و اقلیمی' : 'Current location & sphere of presence';
    return Tooltip(
      message: tooltipMsg,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
        decoration: BoxDecoration(
          color: const Color(0xFF082F49).withValues(alpha: 0.75),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF06B6D4).withValues(alpha: 0.5), width: 1),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF06B6D4).withValues(alpha: 0.15),
              blurRadius: 6,
              spreadRadius: 1,
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.explore_outlined, size: 13, color: Color(0xFF22D3EE)),
            const SizedBox(width: 5),
            Directionality(
              textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
              child: Text(
                locationText,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFE0F2FE),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresenceChip(BuildContext context, ConditionMeta meta) {
    final label = isPersian ? meta.labelFa : meta.labelEn;
    final tooltip = isPersian ? meta.tooltipFa : meta.tooltipEn;

    return Tooltip(
      message: tooltip,
      preferBelow: false,
      child: InkWell(
        onTap: () {
          ScaffoldMessenger.of(context).clearSnackBars();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  Icon(meta.icon, color: meta.accentColor, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tooltip,
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
              duration: const Duration(seconds: 3),
              behavior: SnackBarBehavior.floating,
              backgroundColor: const Color(0xFF1E293B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        },
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: meta.backgroundColor.withValues(alpha: 0.65),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: meta.accentColor.withValues(alpha: 0.45), width: 1),
            boxShadow: [
              BoxShadow(
                color: meta.accentColor.withValues(alpha: 0.12),
                blurRadius: 6,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(meta.icon, size: 12, color: meta.accentColor),
              const SizedBox(width: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: meta.accentColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final rawConditions = {
      ...conditions,
      ...?playerState?.conditions,
    }.toList();

    // 1. Spatial Presence: Macro + Micro-Location
    final resolvedLocation = GameSessionState.locationWithSubZone(
          lore,
          playerState?.currentLocationId,
          playerState?.currentSubZoneId,
        ) ??
        locationName?.trim();

    // 2. Physical Body Badges (Dynamic Baseline)
    final bodyBadges = _deriveBodyConditions(rawConditions);

    // 3. Mental Mind Badges (Dynamic Baseline)
    final mindBadges = _deriveMindConditions(rawConditions);

    // 4. Other Contextual / Stance Badges
    final otherConditions = _extractOtherConditions(rawConditions);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.08),
          width: 1,
        ),
      ),
      child: Wrap(
        spacing: 7,
        runSpacing: 7,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (resolvedLocation != null && resolvedLocation.isNotEmpty)
            _buildLocationBadge(context, resolvedLocation),

          // Body Zone
          ...bodyBadges.map((meta) => _buildPresenceChip(context, meta)),

          // Mind Zone
          ...mindBadges.map((meta) => _buildPresenceChip(context, meta)),

          // Other Contextual Tags
          ...otherConditions.map((cond) {
            final key = cond.trim();
            final meta = _conditionRegistry[key];
            if (meta != null) {
              return _buildPresenceChip(context, meta);
            }
            return _buildPresenceChip(
              context,
              ConditionMeta(
                labelFa: key,
                labelEn: key,
                icon: Icons.tag_outlined,
                accentColor: Colors.blueGrey.shade300,
                backgroundColor: const Color(0xFF1E293B),
                tooltipFa: key,
                tooltipEn: key,
              ),
            );
          }),
        ],
      ),
    );
  }
}

/// Backward-compatible wrapper delegating to [VitalityPresenceBar].
class ConditionChips extends StatelessWidget {
  final List<String> conditions;
  final bool isPersian;
  final String? locationName;
  final PlayerState? playerState;
  final Map<String, dynamic>? lore;

  const ConditionChips({
    super.key,
    required this.conditions,
    this.isPersian = true,
    this.locationName,
    this.playerState,
    this.lore,
  });

  @override
  Widget build(BuildContext context) {
    return VitalityPresenceBar(
      playerState: playerState,
      lore: lore,
      conditions: conditions,
      isPersian: isPersian,
      locationName: locationName,
    );
  }
}
