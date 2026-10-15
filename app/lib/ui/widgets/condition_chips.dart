import 'package:flutter/material.dart';

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
  'تشنه': ConditionMeta(
    labelFa: 'تشنه',
    labelEn: 'Thirsty',
    icon: Icons.water_drop_outlined,
    accentColor: Colors.lightBlueAccent,
    backgroundColor: Color(0xFF0C2A4A),
    tooltipFa: 'کمبود آب و خشکی گلو؛ ادامهٔ تشنگی توان بدنی را تحلیل می‌برد.',
    tooltipEn: 'Dehydration; continuous lack of water drains physical stamina.',
  ),
  'خسته': ConditionMeta(
    labelFa: 'خسته',
    labelEn: 'Exhausted',
    icon: Icons.air_rounded,
    accentColor: Colors.amberAccent,
    backgroundColor: Color(0xFF452C06),
    tooltipFa: 'فرسودگی ناشی از راهپیمایی طولانی یا نبرد؛ واکنش‌ها کندتر شده‌اند.',
    tooltipEn: 'Fatigue from prolonged march or combat; reactions are sluggish.',
  ),
  'زخمی': ConditionMeta(
    labelFa: 'زخمی',
    labelEn: 'Wounded',
    icon: Icons.heart_broken_rounded,
    accentColor: Colors.redAccent,
    backgroundColor: Color(0xFF4A0E17),
    tooltipFa: 'جراحت بر تن؛ نیازمند مداوا یا پانسمان پیش از درگیری مجدد.',
    tooltipEn: 'Severe wound; requires treatment or bandaging before further strain.',
  ),
  'ناآشنا': ConditionMeta(
    labelFa: 'ناآشنا',
    labelEn: 'Outsider',
    icon: Icons.explore_outlined,
    accentColor: Colors.indigoAccent,
    backgroundColor: Color(0xFF1E1E4A),
    tooltipFa: 'غریبه در اقلیم؛ راه‌ها و خلق‌وخوی محلی‌ها برایت تازه است.',
    tooltipEn: 'Stranger to this land; local routes and temperaments are unfamiliar.',
  ),
  'هوشیار': ConditionMeta(
    labelFa: 'هوشیار',
    labelEn: 'Vigilant',
    icon: Icons.visibility_outlined,
    accentColor: Colors.tealAccent,
    backgroundColor: Color(0xFF09332C),
    tooltipFa: 'حواس جمع و گوش‌به‌زنگ؛ نشانه‌های خطر را زودتر درمی‌یابی.',
    tooltipEn: 'Alert and watchful; hazards and ambushes are caught early.',
  ),
  'گیج': ConditionMeta(
    labelFa: 'گیج',
    labelEn: 'Dazed',
    icon: Icons.psychology_outlined,
    accentColor: Colors.purpleAccent,
    backgroundColor: Color(0xFF330E40),
    tooltipFa: 'سرگیجه یا شوک؛ تمرکز ذهنی کاهش یافته است.',
    tooltipEn: 'Mental disorientation from shock or blunt trauma.',
  ),
  'مسموم': ConditionMeta(
    labelFa: 'مسموم',
    labelEn: 'Poisoned',
    icon: Icons.science_outlined,
    accentColor: Colors.lightGreenAccent,
    backgroundColor: Color(0xFF1B3D0E),
    tooltipFa: 'زهر در خون جریان دارد؛ هر حرکت بدنی آسیب به همراه دارد.',
    tooltipEn: 'Venom coursing through blood; physical exertion incurs pain.',
  ),
  'مظنون': ConditionMeta(
    labelFa: 'مظنون',
    labelEn: 'Suspected',
    icon: Icons.warning_amber_rounded,
    accentColor: Colors.amber,
    backgroundColor: Color(0xFF3D320B),
    tooltipFa: 'تحت نظر مأموران تفتیش؛ هر رفتار مشکوک جلب توجه می‌کند.',
    tooltipEn: 'Under watch by inquisitors or guards; suspicious acts draw scrutiny.',
  ),
};

/// Renders dynamic character conditions (e.g. ['تشنه', 'خسته', 'ناآشنا'])
/// as stylish badges at the top of the scene, plus an optional current
/// location chip (e.g. resolved via lore from currentLocationId).
class ConditionChips extends StatelessWidget {
  final List<String> conditions;
  final bool isPersian;
  final String? locationName;

  const ConditionChips({
    super.key,
    required this.conditions,
    this.isPersian = true,
    this.locationName,
  });

  @override
  Widget build(BuildContext context) {
    final loc = (locationName?.trim() ?? '');
    final hasLocation = loc.isNotEmpty;
    if (conditions.isEmpty && !hasLocation) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            isPersian ? 'وضعیت:' : 'Status:',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.grey.shade400,
            ),
          ),
          if (hasLocation)
            Tooltip(
              message: isPersian ? 'مکان فعلی قهرمان' : 'Current location',
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF0B2B3A).withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.cyanAccent.withValues(alpha: 0.5), width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.cyanAccent.withValues(alpha: 0.15),
                      blurRadius: 6,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.place_outlined, size: 12, color: Colors.cyanAccent),
                    const SizedBox(width: 4),
                    Text(
                      loc,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.cyanAccent,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ...conditions.map((raw) {
            final key = raw.trim();
            final meta = _conditionRegistry[key];
            final label = meta != null ? (isPersian ? meta.labelFa : meta.labelEn) : key;
            final icon = meta?.icon ?? Icons.shield_outlined;
            final accent = meta?.accentColor ?? Colors.blueGrey.shade300;
            final bg = meta?.backgroundColor ?? Colors.grey.shade900;
            final tooltip = meta != null ? (isPersian ? meta.tooltipFa : meta.tooltipEn) : key;

            return Tooltip(
              message: tooltip,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: bg.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: accent.withValues(alpha: 0.5), width: 1),
                  boxShadow: [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.15),
                      blurRadius: 6,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 12, color: accent),
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: accent,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
