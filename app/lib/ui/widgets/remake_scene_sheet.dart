import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum ContinuityIssueType {
  ghostNpc,
  repeatedEvent,
  outcomeDisconnect,
  loreContradiction,
  other,
}

class ContinuityIssueItem {
  final ContinuityIssueType type;
  final String id;
  final String titleFa;
  final String titleEn;
  final String descFa;
  final String descEn;
  final IconData icon;

  const ContinuityIssueItem({
    required this.type,
    required this.id,
    required this.titleFa,
    required this.titleEn,
    required this.descFa,
    required this.descEn,
    required this.icon,
  });
}

const List<ContinuityIssueItem> kContinuityIssues = [
  ContinuityIssueItem(
    type: ContinuityIssueType.ghostNpc,
    id: 'ghost_npc',
    titleFa: 'حضور شخصیت ناممکن',
    titleEn: 'Ghost NPC / Absent Character',
    descFa: 'شخصیتی در صحنه حاضر شده که در این کاروان، مکان یا همراهان نیست.',
    descEn: 'An NPC appeared who is not in the current location or party.',
    icon: Icons.person_off_rounded,
  ),
  ContinuityIssueItem(
    type: ContinuityIssueType.repeatedEvent,
    id: 'repeated_event',
    titleFa: 'تکرار رویداد پیشین',
    titleEn: 'Repeated Event / Amnesia',
    descFa: 'رویداد، کنش یا گفت‌وگویی عیناً مشابه صحنه یا نوبت قبلی تکرار شده است.',
    descEn: 'A dialogue or event from the previous turn was repeated.',
    icon: Icons.replay_rounded,
  ),
  ContinuityIssueItem(
    type: ContinuityIssueType.outcomeDisconnect,
    id: 'outcome_disconnect',
    titleFa: 'ناهماهنگی توصیف با اقدام',
    titleEn: 'Outcome Disconnect',
    descFa: 'توصیف صحنه با نتیجه یا موفقیت اقدام انجام‌شده همخوانی ندارد.',
    descEn: 'The scene narrative does not align with the action outcome.',
    icon: Icons.compare_arrows_rounded,
  ),
  ContinuityIssueItem(
    type: ContinuityIssueType.loreContradiction,
    id: 'lore_contradiction',
    titleFa: 'تناقض با قوانین جهان',
    titleEn: 'Lore Contradiction',
    descFa: 'اتفاقی رخ داده که با قواعد فیزیکی، جادویی یا تاریخی جهان داستان در تضاد است.',
    descEn: 'An event contradicted world laws, magic systems, or established history.',
    icon: Icons.auto_stories_rounded,
  ),
  ContinuityIssueItem(
    type: ContinuityIssueType.other,
    id: 'other',
    titleFa: 'ناهماهنگی دیگر',
    titleEn: 'Other Continuity Error',
    descFa: 'خطای تداومی یا اشتباه منطقی دیگری در روایت صحنه رخ داده است.',
    descEn: 'Another narrative inconsistency or hallucination.',
    icon: Icons.help_outline_rounded,
  ),
];

class RemakeSceneSheet extends StatefulWidget {
  final bool isPersian;
  final Future<bool> Function(String issueId, String reason) onRemake;

  const RemakeSceneSheet({
    super.key,
    required this.isPersian,
    required this.onRemake,
  });

  static Future<bool?> show(
    BuildContext context, {
    required bool isPersian,
    required Future<bool> Function(String issueId, String reason) onRemake,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RemakeSceneSheet(
        isPersian: isPersian,
        onRemake: onRemake,
      ),
    );
  }

  @override
  State<RemakeSceneSheet> createState() => _RemakeSceneSheetState();
}

class _RemakeSceneSheetState extends State<RemakeSceneSheet> {
  ContinuityIssueItem _selectedIssue = kContinuityIssues.first;
  final TextEditingController _reasonController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorText;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final text = _reasonController.text.trim();
    if (text.length < 10) {
      setState(() {
        _errorText = widget.isPersian
            ? 'لطفاً دست‌کم ۱۰ حرف دربارهٔ ناهماهنگی صحنه توضیح دهید.'
            : 'Please provide at least 10 characters explaining the issue.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorText = null;
    });

    final success = await widget.onRemake(
      _selectedIssue.id,
      '${_selectedIssue.titleEn}: $text',
    );

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.of(context).pop(true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final isPersian = widget.isPersian;

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Container(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: 24 + bottomInset,
        ),
        decoration: const BoxDecoration(
          color: Color(0xFF13141F),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(
            top: BorderSide(color: Color(0xFFF59E0B), width: 1.5),
            left: BorderSide(color: Color(0x33F59E0B)),
            right: BorderSide(color: Color(0x33F59E0B)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black,
              blurRadius: 30,
              offset: Offset(0, -8),
            ),
          ],
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag Handle
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                    ),
                    child: const Icon(
                      Icons.rotate_left_rounded,
                      color: Color(0xFFF59E0B),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isPersian ? 'بازسازی صحنه (گزارش ناهماهنگی)' : 'Remake Scene (Continuity Fix)',
                          style: GoogleFonts.vazirmatn(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFFDE68A),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isPersian
                              ? '۱ بار رایگان در هر صحنه برای رفع تناقض روایی'
                              : '1x Free per scene to correct narrative contradictions',
                          style: GoogleFonts.vazirmatn(
                            fontSize: 11,
                            color: const Color(0xFF10B981),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Issue Category Selector
              Text(
                isPersian ? 'نوع ناهماهنگی مشاهده‌شده:' : 'Continuity Issue Type:',
                style: GoogleFonts.vazirmatn(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 8),

              for (final issue in kContinuityIssues) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () {
                      setState(() {
                        _selectedIssue = issue;
                        _errorText = null;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: _selectedIssue.type == issue.type
                            ? const Color(0xFFF59E0B).withValues(alpha: 0.12)
                            : const Color(0xFF1E2032),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _selectedIssue.type == issue.type
                              ? const Color(0xFFF59E0B)
                              : Colors.white12,
                          width: _selectedIssue.type == issue.type ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            issue.icon,
                            size: 18,
                            color: _selectedIssue.type == issue.type
                                ? const Color(0xFFF59E0B)
                                : Colors.white60,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isPersian ? issue.titleFa : issue.titleEn,
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: _selectedIssue.type == issue.type
                                        ? const Color(0xFFFDE68A)
                                        : Colors.white,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  isPersian ? issue.descFa : issue.descEn,
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 10.5,
                                    color: Colors.white54,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _selectedIssue.type == issue.type
                                    ? const Color(0xFFF59E0B)
                                    : Colors.white24,
                                width: 2,
                              ),
                              color: _selectedIssue.type == issue.type
                                  ? const Color(0xFFF59E0B)
                                  : Colors.transparent,
                            ),
                            child: _selectedIssue.type == issue.type
                                ? const Icon(Icons.check, size: 12, color: Colors.black)
                                : null,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 14),

              // Specific Reason Input
              Text(
                isPersian ? 'توضیح مشخص ناهماهنگی (دست‌کم ۱۰ حرف):' : 'Specific Explanation (min 10 chars):',
                style: GoogleFonts.vazirmatn(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                style: GoogleFonts.vazirmatn(fontSize: 13, color: Colors.white),
                onChanged: (_) {
                  if (_errorText != null) setState(() => _errorText = null);
                },
                decoration: InputDecoration(
                  hintText: isPersian
                      ? 'مثلاً: فرنگیس هنوز در واحه مانده و نباید در این غار با من حرف بزند...'
                      : 'e.g.: Farangis stayed behind at the oasis, she cannot be here in the cave...',
                  hintStyle: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white30),
                  filled: true,
                  fillColor: const Color(0xFF1E2032),
                  contentPadding: const EdgeInsets.all(12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Colors.white12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFF59E0B), width: 1.5),
                  ),
                ),
              ),

              if (_errorText != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 16),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _errorText!,
                        style: GoogleFonts.vazirmatn(fontSize: 11, color: const Color(0xFFEF4444)),
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 18),

              // Submit & Cancel Buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: Colors.white24),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
                      child: Text(
                        isPersian ? 'انصراف' : 'Cancel',
                        style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF59E0B),
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        elevation: 4,
                      ),
                      onPressed: _isSubmitting ? null : _handleSubmit,
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                            )
                          : const Icon(Icons.auto_fix_high_rounded, size: 18),
                      label: Text(
                        _isSubmitting
                            ? (isPersian ? 'در حال بازسازی...' : 'Remaking...')
                            : (isPersian ? 'بازسازی صحنه (رایگان)' : 'Remake Scene (Free)'),
                        style: GoogleFonts.vazirmatn(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
