import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/auth_provider.dart';
import '../../services/audio_service.dart';
import '../../services/auth_service.dart';
import '../widgets/app_toast.dart';
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
      useSafeArea: true,
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
      AppToast.error(
        context,
        'لطفاً شماره موبایل و رمز عبور را وارد کنید.',
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
      AppToast.welcome(
        context,
        'با موفقیت وارد شدید. خوش آمدید!',
        title: 'ورود موفق',
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
    final contact = _regPhoneCtrl.text.trim();
    final pass = _regPassCtrl.text.trim();
    final name = _regNameCtrl.text.trim();

    if (contact.isEmpty || pass.isEmpty) {
      AppToast.error(
        context,
        'لطفاً شماره موبایل یا نشانی ایمیل و رمز عبور را وارد کنید.',
      );
      return;
    }

    if (pass.length < 6) {
      AppToast.error(
        context,
        'رمز عبور باید حداقل ۶ کاراکتر باشد.',
      );
      return;
    }

    final isEmail = contact.contains('@');
    AudioService().playSfx(SfxType.buttonClick);
    final success = await ref.read(authProvider.notifier).register(
          phoneNumber: isEmail ? null : contact,
          email: isEmail ? contact : null,
          password: pass,
          name: name.isNotEmpty ? name : null,
        );

    if (success && mounted) {
      widget.onAuthSuccess?.call();
      AppToast.welcome(
        context,
        'حساب کاربری ایجاد شد! ۱۵ صحنه رایگان به شما اهدا گردید.',
        title: 'ثبت‌نام موفق',
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

  void _handleBazaarLogin() {
    AudioService().playSfx(SfxType.buttonClick);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _BazaarConnectSheet(
        onSuccess: () {
          widget.onAuthSuccess?.call();
          if (Navigator.of(context).canPop()) {
            Navigator.of(context).pop(true);
          } else {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (context) => const StoryCatalogScreen()),
              (route) => false,
            );
          }
        },
      ),
    );
  }

  void _openForgotPasswordSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const _ForgotPasswordSheet(),
    );
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
          height: 275,
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildLoginForm(authState.isLoading),
              _buildRegisterForm(authState.isLoading),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Divider
        Row(
          children: [
            const Expanded(child: Divider(color: Color(0xFF272A3C))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                'یا',
                style: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 12),
              ),
            ),
            const Expanded(child: Divider(color: Color(0xFF272A3C))),
          ],
        ),
        const SizedBox(height: 12),

        // Cafe Bazaar 1-Tap Login Button
        _buildBazaarButton(authState.isLoading),
      ],
    );
  }

  Widget _buildBazaarButton(bool isLoading) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: OutlinedButton(
        onPressed: isLoading ? null : _handleBazaarLogin,
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFF10B981), width: 1.2),
          backgroundColor: const Color(0xFF10B981).withValues(alpha: 0.08),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF10B981)),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.shopping_bag_outlined, color: Color(0xFF10B981), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'ورود سریع با حساب کافه‌بازار',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF10B981),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildLoginForm(bool isLoading) {
    return Column(
      children: [
        _buildTextField(
          controller: _loginPhoneCtrl,
          hint: 'شماره موبایل یا ایمیل',
          icon: Icons.person_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 10),
        _buildTextField(
          controller: _loginPassCtrl,
          hint: 'رمز عبور',
          icon: Icons.lock_outline_rounded,
          isPassword: true,
        ),
        const SizedBox(height: 4),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => _openForgotPasswordSheet(context),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'فراموشی رمز عبور؟',
              style: GoogleFonts.vazirmatn(
                fontSize: 12.5,
                color: const Color(0xFFF59E0B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
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
          hint: 'شماره موبایل یا ایمیل',
          icon: Icons.contact_mail_outlined,
          keyboardType: TextInputType.emailAddress,
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
          isRtl: true,
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
    bool isRtl = false,
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
        textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
        textAlign: isRtl ? TextAlign.right : TextAlign.left,
        style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: hint,
          hintTextDirection: TextDirection.rtl,
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

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet();

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _emailCtrl = TextEditingController();
  final TextEditingController _tokenCtrl = TextEditingController();
  final TextEditingController _newPassCtrl = TextEditingController();

  bool _isEmailLoading = false;
  bool _isResetLoading = false;
  bool _isPasswordVisible = false;
  String? _infoMessage;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailCtrl.dispose();
    _tokenCtrl.dispose();
    _newPassCtrl.dispose();
    super.dispose();
  }

  void _handleSendEmail() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      AppToast.error(context, 'لطفاً یک نشانی ایمیل معتبر وارد کنید.');
      return;
    }

    setState(() {
      _isEmailLoading = true;
      _infoMessage = null;
    });

    try {
      final res = await AuthService.forgotPassword(email);
      if (mounted) {
        setState(() => _isEmailLoading = false);
        if (res['success'] == true) {
          setState(() {
            _infoMessage = 'پیوند بازنشانی به ایمیل شما ارسال گردید. اگر کد بازنشانی دریافت کرده‌اید، آن را در مرحله ۲ وارد کنید.';
          });
          AppToast.success(
            context,
            'ایمیل بازنشانی ارسال شد. لطفاً صندوق ورودی ایمیل خود را بررسی کنید.',
            title: 'ارسال موفق',
          );
          _tabController.animateTo(1);
        } else {
          AppToast.error(context, res['error'] ?? 'خطا در ارسال ایمیل.');
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isEmailLoading = false);
        AppToast.error(context, 'خطا در برقراری ارتباط: $e');
      }
    }
  }

  void _handleResetPassword() async {
    final token = _tokenCtrl.text.trim();
    final newPass = _newPassCtrl.text.trim();

    if (token.isEmpty) {
      AppToast.error(context, 'لطفاً کد یا توکن دریافت شده را وارد کنید.');
      return;
    }

    if (newPass.length < 6) {
      AppToast.error(context, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setState(() => _isResetLoading = true);

    try {
      final res = await AuthService.resetPassword(
        token: token,
        newPassword: newPass,
      );
      if (mounted) {
        setState(() => _isResetLoading = false);
        if (res['success'] == true) {
          Navigator.of(context).pop();
          AppToast.success(
            context,
            'گذرواژه با موفقیت تغییر کرد. اکنون با رمز جدید وارد شوید.',
            title: 'تغییر موفق رمز',
          );
        } else {
          AppToast.error(context, res['error'] ?? 'خطا در بازنشانی رمز عبور.');
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isResetLoading = false);
        AppToast.error(context, 'خطا در برقراری ارتباط: $e');
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
              24,
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
                    'بازیابی و بازنشانی گذرواژه',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFFF59E0B),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Tab Bar for Step 1 vs Step 2
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
                  labelStyle: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold, fontSize: 13),
                  tabs: const [
                    Tab(text: '۱. ارسال کد به ایمیل'),
                    Tab(text: '۲. ثبت گذرواژه جدید'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              if (_infoMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(10),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _infoMessage!,
                          style: GoogleFonts.vazirmatn(color: const Color(0xFF10B981), fontSize: 12.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              SizedBox(
                height: 230,
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Step 1: Send reset email
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'نشانی ایمیل حساب کاربری خود را وارد کنید تا پیوند و کد بازنشانی برایتان ارسال شود.',
                          style: GoogleFonts.vazirmatn(color: const Color(0xFFA1A1AA), fontSize: 12.5),
                        ),
                        const SizedBox(height: 12),
                        _buildField(
                          controller: _emailCtrl,
                          hint: 'example@email.com',
                          icon: Icons.alternate_email_rounded,
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const Spacer(),
                        SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _isEmailLoading ? null : _handleSendEmail,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: const Color(0xFF0F111D),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: _isEmailLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F111D)),
                                  )
                                : Text(
                                    'ارسال ایمیل بازنشانی',
                                    style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold),
                                  ),
                          ),
                        ),
                      ],
                    ),

                    // Step 2: Enter token & new password
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'کد یا توکن دریافت شده از ایمیل و گذرواژه جدید دلخواه را وارد کنید.',
                          style: GoogleFonts.vazirmatn(color: const Color(0xFFA1A1AA), fontSize: 12.5),
                        ),
                        const SizedBox(height: 10),
                        _buildField(
                          controller: _tokenCtrl,
                          hint: 'کد یا توکن بازنشانی (ارسال‌شده به ایمیل)',
                          icon: Icons.vpn_key_outlined,
                        ),
                        const SizedBox(height: 10),
                        _buildField(
                          controller: _newPassCtrl,
                          hint: 'گذرواژه جدید (حداقل ۶ کاراکتر)',
                          icon: Icons.lock_outline_rounded,
                          isPassword: true,
                        ),
                        const Spacer(),
                        SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _isResetLoading ? null : _handleResetPassword,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: const Color(0xFF0F111D),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: _isResetLoading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F111D)),
                                  )
                                : Text(
                                    'ذخیره و تغییر گذرواژه',
                                    style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold),
                                  ),
                          ),
                        ),
                      ],
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

  Widget _buildField({
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
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }
}

class _BazaarConnectSheet extends ConsumerStatefulWidget {
  final VoidCallback onSuccess;

  const _BazaarConnectSheet({required this.onSuccess});

  @override
  ConsumerState<_BazaarConnectSheet> createState() => _BazaarConnectSheetState();
}

class _BazaarConnectSheetState extends ConsumerState<_BazaarConnectSheet> {
  final TextEditingController _contactCtrl = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _contactCtrl.dispose();
    super.dispose();
  }

  void _submit({bool anonymous = false}) async {
    final contact = anonymous ? '' : _contactCtrl.text.trim();
    final isEmail = contact.contains('@');

    setState(() => _isLoading = true);
    AudioService().playSfx(SfxType.buttonClick);

    final success = await ref.read(authProvider.notifier).loginWithBazaar(
          phoneNumber: (!anonymous && !isEmail && contact.isNotEmpty) ? contact : null,
          email: (!anonymous && isEmail && contact.isNotEmpty) ? contact : null,
        );

    if (mounted) setState(() => _isLoading = false);

    if (success && mounted) {
      Navigator.of(context).pop();
      AppToast.welcome(
        context,
        'با حساب کافه‌بازار با موفقیت وارد شدید!',
        title: 'ورود موفق',
      );
      widget.onSuccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasInput = _contactCtrl.text.trim().isNotEmpty;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom +
              MediaQuery.of(context).padding.bottom +
              24,
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
                  const Icon(Icons.shopping_bag_outlined, color: Color(0xFF10B981), size: 24),
                  const SizedBox(width: 8),
                  Text(
                    'ورود با حساب کافه‌بازار',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF10B981),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'برای ذخیره ابری پیشرفت داستان‌ها و جلوگیری از ایجاد حساب تکراری، شماره موبایل یا ایمیل خود را وارد نمایید (اختیاری):',
                textAlign: TextAlign.center,
                style: GoogleFonts.vazirmatn(
                  fontSize: 12.5,
                  color: const Color(0xFFA1A1AA),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 16),

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
                  onChanged: (_) => setState(() {}),
                  style: GoogleFonts.vazirmatn(color: Colors.white, fontSize: 13.5),
                  decoration: InputDecoration(
                    hintText: 'شماره موبایل یا ایمیل (اختیاری)',
                    hintTextDirection: TextDirection.rtl,
                    hintStyle: GoogleFonts.vazirmatn(color: const Color(0xFF71717A), fontSize: 12.5),
                    prefixIcon: const Icon(Icons.contact_mail_outlined, color: Color(0xFF10B981), size: 19),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : () => _submit(anonymous: false),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
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
                          hasInput ? 'ورود و همگام‌سازی با شماره/ایمیل' : 'ورود مستقیم با بازار (۱ لمس)',
                          style: GoogleFonts.vazirmatn(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                ),
              ),

              if (hasInput) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _isLoading ? null : () => _submit(anonymous: true),
                  child: Text(
                    'ورود بدون شماره (مهمان کافه‌بازار)',
                    style: GoogleFonts.vazirmatn(
                      fontSize: 12.5,
                      color: const Color(0xFFA1A1AA),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}


