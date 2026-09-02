import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../providers/auth_provider.dart';
import '../../services/audio_service.dart';
import '../screens/auth_screen.dart';
import '../screens/shop_screen.dart';

class ProfileDrawer extends ConsumerStatefulWidget {
  const ProfileDrawer({super.key});

  @override
  ConsumerState<ProfileDrawer> createState() => _ProfileDrawerState();
}

class _ProfileDrawerState extends ConsumerState<ProfileDrawer> {
  late bool _isSfxEnabled;
  late bool _isAmbientEnabled;

  @override
  void initState() {
    super.initState();
    _isSfxEnabled = !AudioService().isSfxMuted;
    _isAmbientEnabled = !AudioService().isAmbientMuted;
  }

  void _showAboutDialog(BuildContext context) {
    AudioService().playSfx(SfxType.buttonClick);
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF121422),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF2E334D)),
          ),
          title: Row(
            children: [
              const Icon(Icons.auto_stories_rounded, color: Color(0xFFF59E0B), size: 24),
              const SizedBox(width: 8),
              Text(
                'درباره افسانه‌ساز',
                style: GoogleFonts.vazirmatn(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          content: Text(
            'افسانه‌ساز (AfsanehSaz) پلتفرم رمان‌های تعاملی و ماجراجویی‌های نقش‌آفرینی زنده با هوش مصنوعی است. هر تصمیم شما مسیر سرنوشت را دگرگون می‌کند و دنیای داستان را مطابق قوانین جهان شکل می‌دهد.',
            style: GoogleFonts.vazirmatn(
              fontSize: 13.5,
              color: const Color(0xFFA1A1AA),
              height: 1.6,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(
                'متوجه شدم',
                style: GoogleFonts.vazirmatn(
                  color: const Color(0xFFF59E0B),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    AudioService().playSfx(SfxType.buttonClick);
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: const Color(0xFF121422),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF2E334D)),
          ),
          title: Row(
            children: [
              const Icon(Icons.logout_rounded, color: Color(0xFFF43F5E), size: 22),
              const SizedBox(width: 8),
              Text(
                'خروج از حساب کاربری',
                style: GoogleFonts.vazirmatn(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          content: Text(
            'آیا مایلید از حساب کاربری خود خارج شوید؟ برای ثبت دوباره پیشرفت‌ها می‌توانید در هر زمان وارد شوید.',
            style: GoogleFonts.vazirmatn(
              fontSize: 13,
              color: const Color(0xFFA1A1AA),
              height: 1.5,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(
                'انصراف',
                style: GoogleFonts.vazirmatn(color: Colors.white60),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                final navigator = Navigator.of(context);
                Navigator.of(ctx).pop(); // Close dialog
                await ref.read(authProvider.notifier).logout();
                navigator.pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => const AuthScreen(isFullScreen: true),
                  ),
                  (route) => false,
                );
              },
              child: Text(
                'خروج',
                style: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final isLoggedIn = authState.isAuthenticated && user != null;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Drawer(
        backgroundColor: const Color(0xFF0C0E1A),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Profile Header Card
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16192E), Color(0xFF101222)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF272D4D)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFFF59E0B), Color(0xFFD97706)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                                blurRadius: 10,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                          child: Center(
                            child: Icon(
                              isLoggedIn ? Icons.shield_rounded : Icons.person_outline_rounded,
                              color: const Color(0xFF0C0E1A),
                              size: 28,
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                isLoggedIn
                                    ? (user.name?.isNotEmpty == true ? user.name! : 'ماجراجوی افسانه‌ساز')
                                    : 'کاربر مهمان',
                                style: GoogleFonts.vazirmatn(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              if (isLoggedIn)
                                Directionality(
                                  textDirection: TextDirection.ltr,
                                  child: Text(
                                    user.phoneNumber,
                                    style: GoogleFonts.vazirmatn(
                                      fontSize: 12.5,
                                      color: const Color(0xFFA1A1AA),
                                    ),
                                  ),
                                )
                              else
                                Text(
                                  'ثبت‌نشده در سامانه',
                                  style: GoogleFonts.vazirmatn(
                                    fontSize: 12,
                                    color: const Color(0xFF71717A),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // Scene Tokens / Credit Badge (Interactive - Tapping opens Store)
                    if (isLoggedIn)
                      Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () {
                            AudioService().playSfx(SfxType.buttonClick);
                            ShopScreen.open(context);
                          },
                          borderRadius: BorderRadius.circular(12),
                          splashColor: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                          highlightColor: const Color(0xFFF59E0B).withValues(alpha: 0.1),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFF59E0B).withValues(alpha: 0.4),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.auto_awesome, color: Color(0xFFF59E0B), size: 16),
                                    const SizedBox(width: 6),
                                    Text(
                                      'اعتبار صحنه‌ها:',
                                      style: GoogleFonts.vazirmatn(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFFFBBF24),
                                      ),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    Directionality(
                                      textDirection: TextDirection.ltr,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF59E0B),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          '${user.creditBalance} صحنه',
                                          style: GoogleFonts.vazirmatn(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: const Color(0xFF0F111D),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.all(3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.add_rounded,
                                        size: 14,
                                        color: Color(0xFFFBBF24),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.of(context).pop(); // Close drawer
                            AuthScreen.open(context);
                          },
                          icon: const Icon(Icons.login_rounded, size: 16),
                          label: Text(
                            'ورود / ثبت‌نام و دریافت ۱۵ صحنه رایگان',
                            style: GoogleFonts.vazirmatn(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF59E0B),
                            foregroundColor: const Color(0xFF0F111D),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              const Divider(color: Color(0xFF1E2238), height: 1),

              // Settings & Controls List
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  children: [
                    // Section Title: Preferences
                    Padding(
                      padding: const EdgeInsets.only(right: 8, bottom: 8, top: 4),
                      child: Text(
                        'صدا و اتمسفر ماجراجویی',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF71717A),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),

                    // SFX Toggle
                    _buildSettingsTile(
                      icon: _isSfxEnabled ? Icons.volume_up_rounded : Icons.volume_off_rounded,
                      iconColor: _isSfxEnabled ? const Color(0xFFF59E0B) : const Color(0xFF71717A),
                      title: 'جلوه‌های صوتی (SFX)',
                      subtitle: 'صدای تاس، ورق زدن و کلیک دکمه‌ها',
                      trailing: Switch(
                        value: _isSfxEnabled,
                        activeThumbColor: const Color(0xFFF59E0B),
                        activeTrackColor: const Color(0xFFF59E0B).withValues(alpha: 0.3),
                        inactiveThumbColor: const Color(0xFF71717A),
                        inactiveTrackColor: const Color(0xFF1E2238),
                        onChanged: (val) {
                          AudioService().playSfx(SfxType.buttonClick);
                          AudioService().toggleSfxMute();
                          setState(() {
                            _isSfxEnabled = val;
                          });
                        },
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Ambient Music Toggle
                    _buildSettingsTile(
                      icon: _isAmbientEnabled ? Icons.music_note_rounded : Icons.music_off_rounded,
                      iconColor: _isAmbientEnabled ? const Color(0xFF10B981) : const Color(0xFF71717A),
                      title: 'موسیقی و صدای محیطی',
                      subtitle: 'نوای تاریک و زمزمه باد در صحنه‌ها',
                      trailing: Switch(
                        value: _isAmbientEnabled,
                        activeThumbColor: const Color(0xFF10B981),
                        activeTrackColor: const Color(0xFF10B981).withValues(alpha: 0.3),
                        inactiveThumbColor: const Color(0xFF71717A),
                        inactiveTrackColor: const Color(0xFF1E2238),
                        onChanged: (val) {
                          AudioService().playSfx(SfxType.buttonClick);
                          AudioService().toggleAmbientMute();
                          setState(() {
                            _isAmbientEnabled = val;
                          });
                        },
                      ),
                    ),

                    const SizedBox(height: 16),
                    const Divider(color: Color(0xFF1E2238), height: 1),
                    const SizedBox(height: 12),

                    // Section Title: System & App
                    Padding(
                      padding: const EdgeInsets.only(right: 8, bottom: 8),
                      child: Text(
                        'درباره سامانه',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 11.5,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF71717A),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),

                    // Store & Credit Packages Tile
                    _buildNavigationTile(
                      icon: Icons.storefront_rounded,
                      iconColor: const Color(0xFFF59E0B),
                      title: 'فروشگاه و خرید صحنه',
                      subtitle: 'تهیه بسته‌های صحنه برای ادامه ماجراجویی',
                      onTap: () {
                        AudioService().playSfx(SfxType.buttonClick);
                        ShopScreen.open(context);
                      },
                    ),

                    const SizedBox(height: 8),

                    // About Tile
                    _buildNavigationTile(
                      icon: Icons.info_outline_rounded,
                      iconColor: const Color(0xFF38BDF8),
                      title: 'درباره افسانه‌ساز',
                      subtitle: 'رمان تعاملی نقش‌آفرینی و شبیه‌ساز روایت',
                      onTap: () => _showAboutDialog(context),
                    ),

                    const SizedBox(height: 8),

                    // App Version & Status
                    _buildSettingsTile(
                      icon: Icons.cloud_done_rounded,
                      iconColor: const Color(0xFF10B981),
                      title: 'سرور داستان‌ها',
                      subtitle: 'متصل به سرور ابری افسانه‌ساز',
                      trailing: Directionality(
                        textDirection: TextDirection.ltr,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                          ),
                          child: Text(
                            'v1.0.0',
                            style: GoogleFonts.vazirmatn(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF34D399),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Footer Logout Button (if logged in)
              if (isLoggedIn) ...[
                const Divider(color: Color(0xFF1E2238), height: 1),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: OutlinedButton.icon(
                    onPressed: () => _confirmLogout(context),
                    icon: const Icon(Icons.logout_rounded, size: 18, color: Color(0xFFF43F5E)),
                    label: Text(
                      'خروج از حساب کاربری',
                      style: GoogleFonts.vazirmatn(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFF43F5E),
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF4C1D24)),
                      backgroundColor: const Color(0xFF2A1016),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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

  Widget _buildSettingsTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required Widget trailing,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1F2338)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.vazirmatn(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                Text(
                  subtitle,
                  style: GoogleFonts.vazirmatn(
                    fontSize: 11,
                    color: const Color(0xFF71717A),
                  ),
                ),
              ],
            ),
          ),
          trailing,
        ],
      ),
    );
  }

  Widget _buildNavigationTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF121422),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF1F2338)),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.vazirmatn(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.vazirmatn(
                      fontSize: 11,
                      color: const Color(0xFF71717A),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFF71717A), size: 14),
          ],
        ),
      ),
    );
  }
}
