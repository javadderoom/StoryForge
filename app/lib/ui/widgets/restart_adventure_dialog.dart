import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class RestartAdventureDialog extends StatelessWidget {
  final bool isPersian;

  const RestartAdventureDialog({
    super.key,
    this.isPersian = true,
  });

  /// Shows the styled confirmation dialog and returns true if the user confirmed restart
  static Future<bool> show(
    BuildContext context, {
    bool isPersian = true,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => RestartAdventureDialog(isPersian: isPersian),
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: AlertDialog(
        backgroundColor: const Color(0xFF121422),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: Color(0xFF2E334D)),
        ),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        actionsPadding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.refresh_rounded,
                color: Color(0xFFF59E0B),
                size: 22,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                isPersian ? 'شروع مجدد ماجراجویی' : 'Restart Adventure',
                style: isPersian
                    ? GoogleFonts.vazirmatn(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      )
                    : GoogleFonts.cinzel(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isPersian
                  ? 'آیا از شروع مجدد ماجراجویی اطمینان دارید؟ تمام پیشرفت فعلی این جلسه بازنشانی خواهد شد و اعتبار مصرف‌شده در این داستان به کیف پول شما بازگردانده می‌شود.'
                  : 'Are you sure you want to restart your adventure? Current session progress will be reset and all credits spent on this story will be refunded to your balance.',
              style: isPersian
                  ? GoogleFonts.vazirmatn(
                      fontSize: 13,
                      color: const Color(0xFFD4D4D8),
                      height: 1.6,
                    )
                  : GoogleFonts.merriweather(
                      fontSize: 12.5,
                      color: const Color(0xFFD4D4D8),
                      height: 1.6,
                    ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.bolt, color: Color(0xFF10B981), size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      isPersian
                        ? 'استرداد کامل صحنه‌ها به موجودی حساب'
                        : 'Full credit refund applied automatically',
                      style: GoogleFonts.vazirmatn(
                        fontSize: 11.5,
                        color: const Color(0xFF34D399),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              isPersian ? 'انصراف' : 'Cancel',
              style: GoogleFonts.vazirmatn(
                color: Colors.white60,
                fontSize: 13,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(
              isPersian ? 'بازنشانی و استرداد' : 'Reset & Refund',
              style: GoogleFonts.vazirmatn(
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
