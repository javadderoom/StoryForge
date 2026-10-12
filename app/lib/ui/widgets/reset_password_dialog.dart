import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/audio_service.dart';
import '../../services/auth_service.dart';
import 'app_toast.dart';
import '../screens/auth_screen.dart';

class ResetPasswordDialog extends StatefulWidget {
  final String token;

  const ResetPasswordDialog({
    super.key,
    required this.token,
  });

  static Future<void> show(BuildContext context, {required String token}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ResetPasswordDialog(token: token),
    );
  }

  @override
  State<ResetPasswordDialog> createState() => _ResetPasswordDialogState();
}

class _ResetPasswordDialogState extends State<ResetPasswordDialog> {
  final TextEditingController _newPassCtrl = TextEditingController();
  final TextEditingController _confirmPassCtrl = TextEditingController();

  bool _isPasswordVisible = false;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  void _handleSubmit() async {
    final newPass = _newPassCtrl.text.trim();
    final confirmPass = _confirmPassCtrl.text.trim();

    if (newPass.length < 6) {
      setState(() => _errorMessage = 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    if (newPass != confirmPass) {
      setState(() => _errorMessage = 'تکرار رمز عبور با رمز عبور جدید یکسان نیست.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    AudioService().playSfx(SfxType.buttonClick);

    try {
      final res = await AuthService.resetPassword(
        token: widget.token,
        newPassword: newPass,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      if (res['success'] == true) {
        Navigator.of(context).pop();
        AppToast.success(
          context,
          'رمز عبور با موفقیت به‌روزرسانی شد. اکنون وارد شوید.',
          title: 'تغییر موفق رمز',
        );
        AuthScreen.open(context);
      } else {
        setState(() {
          _errorMessage = res['error'] ?? 'خطا در بازنشانی گذرواژه. ممکن است مهلت پیوند منقضی شده باشد.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'خطا در برقراری ارتباط با سرور: $e';
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
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
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
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.lock_reset_rounded, color: Color(0xFFF59E0B), size: 24),
                  const SizedBox(width: 8),
                  Text(
                    'تعیین گذرواژه جدید',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF59E0B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Deep Link Verification Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'پیوند بازنشانی با موفقیت از ایمیل شما تأیید گردید.',
                        style: GoogleFonts.vazirmatn(
                          color: const Color(0xFF10B981),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

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

              // New Password Field
              _buildField(
                controller: _newPassCtrl,
                hint: 'گذرواژه جدید (حداقل ۶ کاراکتر)',
                icon: Icons.lock_outline_rounded,
                isPassword: true,
              ),
              const SizedBox(height: 12),

              // Confirm Password Field
              _buildField(
                controller: _confirmPassCtrl,
                hint: 'تکرار گذرواژه جدید',
                icon: Icons.lock_outline_rounded,
                isPassword: true,
              ),
              const SizedBox(height: 20),

              // Action Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleSubmit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF59E0B),
                    foregroundColor: const Color(0xFF0F111D),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F111D)),
                        )
                      : Text(
                          'تغییر و ذخیره گذرواژه جدید',
                          style: GoogleFonts.vazirmatn(fontSize: 14.5, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isPassword = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF181B2C),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF272A3C)),
      ),
      child: TextField(
        controller: controller,
        obscureText: isPassword && !_isPasswordVisible,
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.left,
        style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 13.5),
        decoration: InputDecoration(
          hintText: hint,
          hintTextDirection: TextDirection.rtl,
          hintStyle: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 12.5),
          prefixIcon: Icon(icon, color: const Color(0xFFF59E0B), size: 19),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    _isPasswordVisible ? Icons.visibility_off : Icons.visibility,
                    color: const Color(0xFF71717A),
                    size: 18,
                  ),
                  onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        ),
      ),
    );
  }
}
