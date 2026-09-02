import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/auth_provider.dart';
import '../../services/audio_service.dart';
import 'story_catalog_screen.dart';

class AuthScreen extends ConsumerStatefulWidget {
  final VoidCallback? onAuthSuccess;
  final bool isFullScreen;

  const AuthScreen({
    super.key,
    this.onAuthSuccess,
    this.isFullScreen = false,
  });

  static Future<bool?> open(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const AuthScreen(),
    );
  }

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final TextEditingController _loginPhoneCtrl = TextEditingController();
  final TextEditingController _loginPassCtrl = TextEditingController();

  final TextEditingController _regPhoneCtrl = TextEditingController();
  final TextEditingController _regPassCtrl = TextEditingController();
  final TextEditingController _regNameCtrl = TextEditingController();

  bool _isPasswordVisible = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginPhoneCtrl.dispose();
    _loginPassCtrl.dispose();
    _regPhoneCtrl.dispose();
    _regPassCtrl.dispose();
    _regNameCtrl.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    final phone = _loginPhoneCtrl.text.trim();
    final pass = _loginPassCtrl.text.trim();

    if (phone.isEmpty || pass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لطفاً شماره موبایل و رمز عبور را وارد کنید.')),
      );
      return;
    }

    AudioService().playSfx(SfxType.buttonClick);
    final success = await ref.read(authProvider.notifier).login(
          phoneNumber: phone,
          password: pass,
        );

    if (success && mounted) {
      widget.onAuthSuccess?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('با موفقیت وارد شدید. خوش آمدید!'),
        ),
      );
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const StoryCatalogScreen()),
          (route) => false,
        );
      }
    }
  }

  void _handleRegister() async {
    final phone = _regPhoneCtrl.text.trim();
    final pass = _regPassCtrl.text.trim();
    final name = _regNameCtrl.text.trim();

    if (phone.isEmpty || pass.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('لطفاً شماره موبایل و رمز عبور را وارد کنید.')),
      );
      return;
    }

    if (pass.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('رمز عبور باید حداقل ۶ کاراکتر باشد.')),
      );
      return;
    }

    AudioService().playSfx(SfxType.buttonClick);
    final success = await ref.read(authProvider.notifier).register(
          phoneNumber: phone,
          password: pass,
          name: name.isNotEmpty ? name : null,
        );

    if (success && mounted) {
      widget.onAuthSuccess?.call();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xFF10B981),
          content: Text('حساب کاربری ایجاد شد! ۱۵ صحنه رایگان به شما اهدا گردید.'),
        ),
      );
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      } else {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const StoryCatalogScreen()),
          (route) => false,
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    if (widget.isFullScreen) {
      return Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          backgroundColor: const Color(0xFF090A12),
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 88,
                        height: 88,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(color: const Color(0xFFF59E0B), width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
                              blurRadius: 18,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Image.asset(
                            'assets/images/app_icon.jpg',
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const Icon(
                              Icons.auto_stories_rounded,
                              color: Color(0xFFF59E0B),
                              size: 44,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'افسانه‌ساز',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF59E0B),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'جهان رمان‌ها و ماجراجویی‌های تعاملی هوش مصنوعی',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.vazirmatn(
                          fontSize: 13,
                          color: const Color(0xFFA1A1AA),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F111D),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: const Color(0xFF272A3C), width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.6),
                              blurRadius: 24,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: _buildAuthCardContent(authState),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
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
                  const Icon(Icons.shield_moon_outlined, color: Color(0xFFF59E0B), size: 24),
                  const SizedBox(width: 8),
                  Text(
                    'حساب کاربری افسانه‌ساز',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF59E0B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildAuthCardContent(authState),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAuthCardContent(AuthState authState) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Welcome Bonus Banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFF59E0B).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.stars_rounded, color: Color(0xFFF59E0B), size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'با ثبت‌نام در افسانه‌ساز، ۱۵ صحنه رایگان هدیه بگیرید.',
                  style: GoogleFonts.vazirmatn(
                    fontSize: 12.5,
                    color: const Color(0xFFFBBF24),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Tabs (ورود / ثبت‌نام)
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF181B2C),
            borderRadius: BorderRadius.circular(14),
          ),
          child: TabBar(
            controller: _tabController,
            dividerColor: Colors.transparent,
            indicatorSize: TabBarIndicatorSize.tab,
            indicator: BoxDecoration(
              color: const Color(0xFFF59E0B),
              borderRadius: BorderRadius.circular(12),
            ),
            labelColor: const Color(0xFF0F111D),
            unselectedLabelColor: const Color(0xFFA1A1AA),
            labelStyle: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold, fontSize: 14),
            tabs: const [
              Tab(text: 'ورود به حساب'),
              Tab(text: 'ثبت‌نام جدید'),
            ],
          ),
        ),
        const SizedBox(height: 20),

        if (authState.errorMessage != null) ...[
          Container(
            padding: const EdgeInsets.all(10),
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
                    authState.errorMessage!,
                    style: GoogleFonts.vazirmatn(color: Colors.redAccent, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Tab Views
        SizedBox(
          height: 260,
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildLoginForm(authState.isLoading),
              _buildRegisterForm(authState.isLoading),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLoginForm(bool isLoading) {
    return Column(
      children: [
        _buildTextField(
          controller: _loginPhoneCtrl,
          hint: 'شماره موبایل (مثال: ۰۹۱۲۱۲۳۴۵۶۷)',
          icon: Icons.phone_iphone_rounded,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 12),
        _buildTextField(
          controller: _loginPassCtrl,
          hint: 'رمز عبور',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
        ),
        const Spacer(),
        _buildActionButton(
          label: 'ورود به دنیای روایت',
          isLoading: isLoading,
          onPressed: _handleLogin,
        ),
      ],
    );
  }

  Widget _buildRegisterForm(bool isLoading) {
    return Column(
      children: [
        _buildTextField(
          controller: _regPhoneCtrl,
          hint: 'شماره موبایل (مثال: ۰۹۱۲۱۲۳۴۵۶۷)',
          icon: Icons.phone_iphone_rounded,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 10),
        _buildTextField(
          controller: _regPassCtrl,
          hint: 'رمز عبور (حداقل ۶ کاراکتر)',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
        ),
        const SizedBox(height: 10),
        _buildTextField(
          controller: _regNameCtrl,
          hint: 'نام ماجراجو (اختیاری)',
          icon: Icons.badge_outlined,
        ),
        const Spacer(),
        _buildActionButton(
          label: 'ثبت‌نام و دریافت ۱۵ صحنه رایگان',
          isLoading: isLoading,
          onPressed: _handleRegister,
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    TextInputType keyboardType = TextInputType.text,
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
        keyboardType: keyboardType,
        style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 13),
          prefixIcon: Icon(icon, color: const Color(0xFFF59E0B), size: 20),
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

  Widget _buildActionButton({
    required String label,
    required bool isLoading,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFF59E0B),
          foregroundColor: const Color(0xFF0F111D),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F111D)),
              )
            : Text(
                label,
                style: GoogleFonts.vazirmatn(fontSize: 14.5, fontWeight: FontWeight.bold),
              ),
      ),
    );
  }
}
