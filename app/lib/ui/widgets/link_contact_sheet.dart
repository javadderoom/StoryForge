import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/auth_provider.dart';
import '../../services/audio_service.dart';
import 'app_toast.dart';

class LinkContactSheet extends ConsumerStatefulWidget {
  const LinkContactSheet({super.key});

  static Future<bool?> open(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const LinkContactSheet(),
    );
  }

  @override
  ConsumerState<LinkContactSheet> createState() => _LinkContactSheetState();
}

class _LinkContactSheetState extends ConsumerState<LinkContactSheet> {
  final TextEditingController _contactCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();
  final TextEditingController _existingPassCtrl = TextEditingController();

  bool _isLoading = false;
  bool _isPasswordVisible = false;
  bool _isExistingPasswordVisible = false;
  bool _requiresExistingPassword = false;
  String? _errorMessage;

  @override
  void dispose() {
    _contactCtrl.dispose();
    _passCtrl.dispose();
    _existingPassCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final contact = _contactCtrl.text.trim();
    final pass = _passCtrl.text.trim();
    final existingPass = _existingPassCtrl.text.trim();

    if (contact.isEmpty) {
      setState(() => _errorMessage = 'لطفاً شماره موبایل یا نشانی ایمیل را وارد کنید.');
      return;
    }

    final isEmail = contact.contains('@');
    final phoneNumber = isEmail ? null : contact;
    final email = isEmail ? contact : null;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    AudioService().playSfx(SfxType.buttonClick);

    try {
      final res = await ref.read(authProvider.notifier).linkContact(
            phoneNumber: phoneNumber,
            email: email,
            password: pass.isNotEmpty ? pass : null,
            existingAccountPassword: existingPass.isNotEmpty ? existingPass : null,
          );

      if (!mounted) return;

      if (res['success'] == true) {
        final bool merged = res['merged'] ?? false;
        Navigator.of(context).pop(true);
        AppToast.success(
          context,
          merged
              ? 'حساب‌ها با موفقیت ادغام شدند و پیشرفت‌ها انتقال یافتند.'
              : 'مشخصات تماس با موفقیت به حساب شما متصل شد.',
          title: merged ? 'ادغام موفق حساب' : 'اتصال موفق',
        );
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = res['error'] ?? 'خطا در اتصال مشخصات.';
          if (res['requiresExistingPassword'] == true) {
            _requiresExistingPassword = true;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'خطا در ارتباط با سرور: $e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom +
              MediaQuery.of(context).padding.bottom +
              20,
          top: 16,
          left: 20,
          right: 20,
        ),
        decoration: const BoxDecoration(
          color: Color(0xFF0F111D),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: Color(0xFF272A3C), width: 1.5)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.link_rounded, color: Color(0xFFF59E0B), size: 24),
                  const SizedBox(width: 8),
                  Text(
                    'اتصال مشخصات و ذخیره ابری',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF59E0B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'برای نگهداری پیشرفت، خریدها و ورود به حساب از طریق دستگاه‌های دیگر، شماره موبایل یا ایمیل خود را متصل کنید.',
                textAlign: TextAlign.center,
                style: GoogleFonts.vazirmatn(
                  fontSize: 12.5,
                  color: const Color(0xFFA1A1AA),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 18),

              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.redAccent, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: GoogleFonts.vazirmatn(color: Colors.redAccent, fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Contact input
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF181B2C),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF272A3C)),
                ),
                child: TextField(
                  controller: _contactCtrl,
                  keyboardType: TextInputType.emailAddress,
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.left,
                  style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 13.5),
                  decoration: InputDecoration(
                    hintText: 'شماره موبایل یا نشانی ایمیل',
                    hintTextDirection: TextDirection.rtl,
                    hintStyle: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 12.5),
                    prefixIcon: const Icon(Icons.contact_mail_outlined, color: Color(0xFFF59E0B), size: 19),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Password input (if new or to set credentials)
              if (!_requiresExistingPassword) ...[
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF181B2C),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF272A3C)),
                  ),
                  child: TextField(
                    controller: _passCtrl,
                    obscureText: !_isPasswordVisible,
                    textDirection: TextDirection.ltr,
                    textAlign: TextAlign.left,
                    style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 13.5),
                    decoration: InputDecoration(
                      hintText: 'تعیین رمز عبور دلخواه (حداقل ۶ کاراکتر)',
                      hintTextDirection: TextDirection.rtl,
                      hintStyle: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 12.5),
                      prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFFF59E0B), size: 19),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isPasswordVisible ? Icons.visibility_off : Icons.visibility,
                          color: const Color(0xFF71717A),
                          size: 18,
                        ),
                        onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
              ],

              // Existing account password input (if conflict found)
              if (_requiresExistingPassword) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    'این شماره یا ایمیل قبلاً ثبت شده است. برای انتقال خریدها و یکی‌شدن دو حساب، رمز عبور حساب موجود را وارد نمایید.',
                    style: GoogleFonts.vazirmatn(fontSize: 12, color: const Color(0xFFFBBF24)),
                  ),
                ),
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF181B2C),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF59E0B)),
                  ),
                  child: TextField(
                    controller: _existingPassCtrl,
                    obscureText: !_isExistingPasswordVisible,
                    textDirection: TextDirection.ltr,
                    textAlign: TextAlign.left,
                    style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 13.5),
                    decoration: InputDecoration(
                      hintText: 'رمز عبور حساب موجود',
                      hintTextDirection: TextDirection.rtl,
                      hintStyle: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 12.5),
                      prefixIcon: const Icon(Icons.security_rounded, color: Color(0xFFF59E0B), size: 19),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isExistingPasswordVisible ? Icons.visibility_off : Icons.visibility,
                          color: const Color(0xFF71717A),
                          size: 18,
                        ),
                        onPressed: () => setState(() => _isExistingPasswordVisible = !_isExistingPasswordVisible),
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 18),

              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: const Color(0xFF0F111D),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F111D)),
                        )
                      : Text(
                          _requiresExistingPassword ? 'ادغام و اتصال حساب‌ها' : 'اتصال مشخصات',
                          style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
