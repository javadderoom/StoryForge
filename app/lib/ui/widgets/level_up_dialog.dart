import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/game_state.dart';
import '../../providers/game_session_provider.dart';
import 'rpg_toast.dart';

class LevelUpDialog extends ConsumerStatefulWidget {
  final PlayerState playerState;
  final bool isPersian;

  const LevelUpDialog({
    super.key,
    required this.playerState,
    this.isPersian = true,
  });

  static Future<void> show(BuildContext context, {required PlayerState playerState, bool isPersian = true}) {
    return showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => LevelUpDialog(
        playerState: playerState,
        isPersian: isPersian,
      ),
    );
  }

  @override
  ConsumerState<LevelUpDialog> createState() => _LevelUpDialogState();
}

class _LevelUpDialogState extends ConsumerState<LevelUpDialog> {
  final Map<String, int> _allocations = {};
  String? _selectedAbilityId;
  bool _isSubmitting = false;

  int get _totalAllocated => _allocations.values.fold(0, (sum, val) => sum + val);

  int get _remainingPoints => (widget.playerState.unspentStatPoints) - _totalAllocated;

  void _increment(String statId) {
    if (_remainingPoints <= 0) return;
    setState(() {
      _allocations[statId] = (_allocations[statId] ?? 0) + 1;
    });
  }

  void _decrement(String statId) {
    final cur = _allocations[statId] ?? 0;
    if (cur <= 0) return;
    setState(() {
      if (cur <= 1) {
        _allocations.remove(statId);
      } else {
        _allocations[statId] = cur - 1;
      }
    });
  }

  Future<void> _handleConfirm() async {
    if (_totalAllocated == 0 && _selectedAbilityId == null) {
      Navigator.of(context).pop();
      return;
    }

    setState(() => _isSubmitting = true);
    final success = await ref.read(gameSessionProvider.notifier).commitLevelUp(
          statAllocations: _allocations,
          chosenAbilityId: _selectedAbilityId,
        );
    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.of(context).pop();
        RpgToast.show(
          context,
          title: widget.isPersian ? 'ارتقای سطح با موفقیت اعمال شد!' : 'Level-Up confirmed!',
          subtitle: widget.isPersian ? 'ویژگی‌ها و توانایی‌های جدید ثبت شدند.' : 'Attributes and abilities updated.',
          type: RpgToastType.success,
          isPersian: widget.isPersian,
        );
      } else {
        RpgToast.show(
          context,
          title: widget.isPersian ? 'خطا در ثبت ارتقای سطح' : 'Failed to commit Level-Up',
          type: RpgToastType.error,
          isPersian: widget.isPersian,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(gameSessionProvider);
    final stats = session.rpgStats;
    final allAbilities = session.rpgAbilities;
    final knownAbilityIds = widget.playerState.abilities.toSet();
    final availableAbilities = allAbilities.where((a) => !knownAbilityIds.contains(a.id)).toList();
    final unspentAbilities = widget.playerState.unspentAbilityPicks;

    return Directionality(
      textDirection: widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 560, maxHeight: 720),
          decoration: BoxDecoration(
            color: const Color(0xFF0D0F1B),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                blurRadius: 32,
                spreadRadius: 4,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 16, 14),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                      ),
                      child: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF10B981), size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                widget.isPersian ? 'ارتقای سطح و پیشرفت' : 'LEVEL UP & ADVANCEMENT',
                                style: widget.isPersian
                                    ? GoogleFonts.vazirmatn(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      )
                                    : GoogleFonts.cinzel(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                        letterSpacing: 1.2,
                                      ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withValues(alpha: 0.2),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                                ),
                                child: Text(
                                  widget.isPersian
                                      ? 'سطح ${toPersianDigits(widget.playerState.level)}'
                                      : 'Lvl ${widget.playerState.level}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF10B981),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.isPersian
                              ? 'امتیازهای کسب‌شده را برای افزایش ویژگی‌های بنیادین تخصیص دهید.'
                              : 'Distribute points into core attributes to increase success modifiers.',
                            style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white60, size: 22),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(color: Color(0xFF1F2438), height: 1),

              // Scrollable Body
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Available Points Banner
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.25)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.arrow_circle_up_rounded, color: Color(0xFF10B981), size: 20),
                              const SizedBox(width: 8),
                              Text(
                                widget.isPersian ? 'امتیاز ویژگی‌های در دسترس:' : 'Available Stat Points:',
                                style: GoogleFonts.vazirmatn(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: _remainingPoints > 0
                                  ? const Color(0xFF10B981).withValues(alpha: 0.25)
                                  : const Color(0xFF1E2235),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: _remainingPoints > 0
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF2B314D),
                              ),
                            ),
                            child: Text(
                              toPersianDigits(_remainingPoints),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: _remainingPoints > 0 ? const Color(0xFF10B981) : Colors.white54,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Core Attributes
                    Text(
                      widget.isPersian ? 'ویژگی‌های اصلی (Attributes)' : 'CORE ATTRIBUTES',
                      style: widget.isPersian
                          ? GoogleFonts.vazirmatn(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B))
                          : GoogleFonts.cinzel(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFFF59E0B)),
                    ),
                    const SizedBox(height: 10),

                    ...stats.map((st) {
                      final currentVal = widget.playerState.stats[st.id] ?? st.baseValue;
                      final allocated = _allocations[st.id] ?? 0;
                      final nextVal = currentVal + allocated;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: allocated > 0
                              ? const Color(0xFF10B981).withValues(alpha: 0.08)
                              : const Color(0xFF13172B),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: allocated > 0
                                ? const Color(0xFF10B981).withValues(alpha: 0.4)
                                : const Color(0xFF1F2438),
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        st.getLocalizedName(widget.isPersian),
                                        style: GoogleFonts.vazirmatn(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Directionality(
                                        textDirection: TextDirection.ltr,
                                        child: Text(
                                          allocated > 0
                                              ? '${toPersianDigits(currentVal)} → ${toPersianDigits(nextVal)}'
                                              : toPersianDigits(currentVal),
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: allocated > 0 ? const Color(0xFF10B981) : Colors.white60,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (st.description.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      st.description,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.vazirmatn(fontSize: 10.5, color: Colors.white54),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline_rounded),
                                  color: allocated > 0 ? const Color(0xFFEF4444) : Colors.white24,
                                  iconSize: 26,
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                  onPressed: allocated > 0 ? () => _decrement(st.id) : null,
                                ),
                                Container(
                                  constraints: const BoxConstraints(minWidth: 26),
                                  alignment: Alignment.center,
                                  child: Text(
                                    allocated > 0 ? '+${toPersianDigits(allocated)}' : '—',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: allocated > 0 ? const Color(0xFF10B981) : Colors.white38,
                                    ),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_rounded),
                                  color: _remainingPoints > 0 ? const Color(0xFF10B981) : Colors.white24,
                                  iconSize: 26,
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                  onPressed: _remainingPoints > 0 ? () => _increment(st.id) : null,
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),

                    // Optional Ability Picks
                    if (unspentAbilities > 0 && availableAbilities.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        widget.isPersian
                            ? 'انتخاب توانایی یا طلسم جدید (${toPersianDigits(unspentAbilities)} انتخاب)'
                            : 'NEW ABILITY UNLOCK ($unspentAbilities pick)',
                        style: widget.isPersian
                            ? GoogleFonts.vazirmatn(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFF38BDF8))
                            : GoogleFonts.cinzel(fontSize: 12, fontWeight: FontWeight.bold, color: const Color(0xFF38BDF8)),
                      ),
                      const SizedBox(height: 10),
                      ...availableAbilities.map((ab) {
                        final isSelected = _selectedAbilityId == ab.id;
                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              _selectedAbilityId = isSelected ? null : ab.id;
                            });
                          },
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF0284C7).withValues(alpha: 0.15)
                                  : const Color(0xFF13172B),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isSelected
                                    ? const Color(0xFF38BDF8)
                                    : const Color(0xFF1F2438),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  isSelected ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                                  color: isSelected ? const Color(0xFF38BDF8) : Colors.white38,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        ab.name,
                                        style: GoogleFonts.vazirmatn(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                      if (ab.description.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          ab.description,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white60),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  ],
                ),
              ),

              // Footer Actions
              const Divider(color: Color(0xFF1F2438), height: 1),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        widget.isPersian ? 'انصراف' : 'Cancel',
                        style: GoogleFonts.vazirmatn(fontSize: 13, color: Colors.white60),
                      ),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: _isSubmitting || (_totalAllocated == 0 && _selectedAbilityId == null)
                          ? null
                          : _handleConfirm,
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                            )
                          : Row(
                              children: [
                                const Icon(Icons.check_rounded, size: 18),
                                const SizedBox(width: 6),
                                Text(
                                  widget.isPersian ? 'تایید و ارتقا' : 'Confirm & Level Up',
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
