import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum ToastType {
  success,
  error,
  info,
  welcome,
}

class AppToast {
  static void show(
    BuildContext context, {
    required String message,
    String? title,
    ToastType type = ToastType.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    Color accentColor;
    IconData icon;
    String defaultTitle;

    switch (type) {
      case ToastType.success:
        accentColor = const Color(0xFF10B981);
        icon = Icons.check_circle_rounded;
        defaultTitle = 'عملیات موفق';
        break;
      case ToastType.error:
        accentColor = const Color(0xFFF43F5E);
        icon = Icons.error_outline_rounded;
        defaultTitle = 'خطا';
        break;
      case ToastType.welcome:
        accentColor = const Color(0xFFF59E0B);
        icon = Icons.stars_rounded;
        defaultTitle = 'خوش آمدید';
        break;
      case ToastType.info:
        accentColor = const Color(0xFF38BDF8);
        icon = Icons.info_outline_rounded;
        defaultTitle = 'اطلاعیه';
        break;
    }

    final effectiveTitle = title ?? (type == ToastType.info ? null : defaultTitle);

    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        elevation: 0,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        duration: duration,
        padding: EdgeInsets.zero,
        content: Directionality(
          textDirection: TextDirection.rtl,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF131728).withValues(alpha: 0.96),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: accentColor.withValues(alpha: 0.45),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.18),
                  blurRadius: 18,
                  spreadRadius: 1,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.55),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: accentColor.withValues(alpha: 0.15),
                    border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                  ),
                  child: Icon(icon, color: accentColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (effectiveTitle != null) ...[
                        Text(
                          effectiveTitle,
                          style: GoogleFonts.vazirmatn(
                            color: accentColor,
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 2),
                      ],
                      Text(
                        message,
                        style: GoogleFonts.vazirmatn(
                          color: Colors.white.withValues(alpha: 0.92),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static void success(BuildContext context, String message, {String? title, Duration? duration}) {
    show(
      context,
      message: message,
      title: title,
      type: ToastType.success,
      duration: duration ?? const Duration(seconds: 3),
    );
  }

  static void error(BuildContext context, String message, {String? title, Duration? duration}) {
    show(
      context,
      message: message,
      title: title,
      type: ToastType.error,
      duration: duration ?? const Duration(seconds: 4),
    );
  }

  static void welcome(BuildContext context, String message, {String? title, Duration? duration}) {
    show(
      context,
      message: message,
      title: title,
      type: ToastType.welcome,
      duration: duration ?? const Duration(seconds: 4),
    );
  }

  static void info(BuildContext context, String message, {String? title, Duration? duration}) {
    show(
      context,
      message: message,
      title: title,
      type: ToastType.info,
      duration: duration ?? const Duration(seconds: 3),
    );
  }
}
