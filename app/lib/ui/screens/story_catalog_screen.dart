import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/story.dart';
import '../../providers/game_session_provider.dart';
import '../../services/game_api_service.dart';
import '../widgets/story_cover_image.dart';
import '../widgets/profile_drawer.dart';
import 'reader_screen.dart';
import 'character_creation_screen.dart';

class StoryCatalogScreen extends ConsumerStatefulWidget {
  const StoryCatalogScreen({super.key});

  @override
  ConsumerState<StoryCatalogScreen> createState() => _StoryCatalogScreenState();
}

class _StoryCatalogScreenState extends ConsumerState<StoryCatalogScreen> {
  List<StorySummary> _stories = [];
  bool _isLoading = true;
  String? _errorMessage;
  String? _startingStoryId;
  DateTime? _lastBackPressTime;

  @override
  void initState() {
    super.initState();
    _loadStories();
  }

  Future<void> _loadStories() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final stories = await GameApiService.fetchStories();
      if (mounted) {
        setState(() {
          _stories = stories;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  String _formatGenreName(String genre, bool isPersian) {
    if (!isPersian) return genre.replaceAll('_', ' ').toUpperCase();
    switch (genre.toLowerCase()) {
      case 'dark_fantasy':
        return 'فانتزی تاریک';
      case 'mystery_noir':
        return 'رازآلود و نوآر';
      case 'gothic':
        return 'گوتیک';
      case 'lovecraftian':
        return 'لاوکرفتی';
      default:
        return genre;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(gameSessionProvider);
    final activeStoryId = session.storyId;
    final hasActiveNarrative = session.currentNarrative.isNotEmpty;
    final isPersian = activeStoryId.isEmpty || session.isPersian;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        final scaffoldState = Scaffold.maybeOf(context);
        if (scaffoldState?.isDrawerOpen == true) {
          Navigator.of(context).pop();
          return;
        }
        if (hasActiveNarrative && Navigator.canPop(context)) {
          Navigator.of(context).pop();
          return;
        }
        final now = DateTime.now();
        if (_lastBackPressTime == null ||
            now.difference(_lastBackPressTime!) > const Duration(seconds: 2)) {
          _lastBackPressTime = now;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              duration: const Duration(seconds: 2),
              backgroundColor: const Color(0xFF1E2238),
              content: Text(
                isPersian
                    ? 'برای خروج از برنامه، دوباره دکمه بازگشت را بزنید.'
                    : 'Press back again to exit.',
                style: GoogleFonts.vazirmatn(),
              ),
            ),
          );
        } else {
          SystemNavigator.pop();
        }
      },
      child: Directionality(
        textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
        child: Scaffold(
          backgroundColor: const Color(0xFF090A10),
          drawer: const ProfileDrawer(),
          appBar: AppBar(
            backgroundColor: const Color(0xFF0F111D),
            elevation: 0,
            leading: (hasActiveNarrative && Navigator.canPop(context))
                ? IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFFF59E0B), size: 20),
                    tooltip: isPersian ? 'بازگشت به خوانش' : 'Back to Reading',
                    onPressed: () => Navigator.of(context).pop(),
                  )
                : Builder(
                    builder: (ctx) => IconButton(
                      icon: const Icon(Icons.menu_rounded, color: Color(0xFFF59E0B), size: 24),
                      tooltip: isPersian ? 'پروفایل و تنظیمات' : 'Profile & Settings',
                      onPressed: () => Scaffold.of(ctx).openDrawer(),
                    ),
                  ),
          title: Text(
            isPersian ? 'کتابخانه ماجراجویی‌ها' : 'ADVENTURE CATALOG',
            style: isPersian
                ? GoogleFonts.vazirmatn(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFF59E0B),
                  )
                : GoogleFonts.cinzel(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFFF59E0B),
                    letterSpacing: 1.5,
                  ),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
              tooltip: isPersian ? 'به‌روزرسانی فهرست' : 'Refresh Catalog',
              onPressed: _loadStories,
            ),
            if (Navigator.canPop(context))
              Builder(
                builder: (ctx) => IconButton(
                  icon: const Icon(Icons.person_outline_rounded, color: Color(0xFFF59E0B)),
                  tooltip: isPersian ? 'پروفایل و تنظیمات' : 'Profile & Settings',
                  onPressed: () => Scaffold.of(ctx).openDrawer(),
                ),
              ),
          ],
        ),
        body: _isLoading
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 68,
                      height: 68,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.5), width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.3),
                            blurRadius: 25,
                          ),
                        ],
                      ),
                      child: const Center(
                        child: SizedBox(
                          width: 32,
                          height: 32,
                          child: CircularProgressIndicator(
                            color: Color(0xFFF59E0B),
                            strokeWidth: 2.5,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      isPersian ? 'در حال بارگذاری تالار سرگذشت‌ها...' : 'Loading Adventure Catalog...',
                      style: GoogleFonts.vazirmatn(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isPersian ? 'احضار جهان‌ها و قوانین کهن' : 'Summoning worlds & ancient lore',
                      style: GoogleFonts.vazirmatn(fontSize: 11, color: Colors.white54),
                    ),
                  ],
                ),
              )
            : _errorMessage != null && _stories.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
                          const SizedBox(height: 16),
                          Text(
                            isPersian ? 'خطا در ارتباط با سرور' : 'Connection Error',
                            style: GoogleFonts.vazirmatn(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _errorMessage!,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white60),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: Colors.black,
                              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: Text(
                              isPersian ? 'تلاش مجدد' : 'Try Again',
                              style: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold),
                            ),
                            onPressed: _loadStories,
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    children: [
                      // Hero Banner
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF1E1710), Color(0xFF131522)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.auto_stories_rounded, color: Color(0xFFF59E0B), size: 28),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isPersian ? 'داستان تعاملی خود را برگزینید' : 'Choose Your Adventure',
                                    style: GoogleFonts.vazirmatn(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    isPersian
                                        ? 'انتخاب‌های شما جهان داستان را شکل می‌دهند و با تاس سرنوشت سنجیده می‌شوند.'
                                        : 'Every choice forges the narrative, resolved with deterministic dice mechanics.',
                                    style: GoogleFonts.vazirmatn(fontSize: 12, color: Colors.white70, height: 1.4),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Stories List
                      for (final story in _stories) ...[
                        _buildStoryCard(
                          story: story,
                          isActive: hasActiveNarrative && story.id == activeStoryId,
                          isPersian: isPersian,
                        ),
                        const SizedBox(height: 20),
                      ],
                    ],
                  ),
        ),
      ),
    );
  }

  Widget _buildStoryCard({
    required StorySummary story,
    required bool isActive,
    required bool isPersian,
  }) {
    final isStoryPersian = story.language == 'fa' ||
        story.language == 'farsi' ||
        RegExp(r'[\u0600-\u06FF]').hasMatch(story.title);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isActive ? const Color(0xFFF59E0B) : const Color(0xFF27272A),
          width: isActive ? 1.8 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: isActive
                ? const Color(0xFFF59E0B).withValues(alpha: 0.15)
                : Colors.black.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cinematic Story Cover Image Header
          StoryCoverImage(
            storyId: story.id,
            coverImageUrl: story.coverImageUrl,
            height: 175,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(23)),
            heroTag: 'story_cover_${story.id}',
            overlayChild: Padding(
              padding: const EdgeInsets.all(14.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Language Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.translate_rounded,
                          size: 13,
                          color: isStoryPersian ? const Color(0xFFF59E0B) : Colors.white70,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          isStoryPersian ? 'فارسی' : 'English',
                          style: GoogleFonts.vazirmatn(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Active Badge
                  if (isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF10B981).withValues(alpha: 0.4),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isPersian ? 'در حال بازی' : 'ACTIVE',
                            style: GoogleFonts.vazirmatn(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title & Tagline
                Text(
                  story.title,
                  style: isStoryPersian
                      ? GoogleFonts.vazirmatn(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF59E0B),
                        )
                      : GoogleFonts.cinzel(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF59E0B),
                          letterSpacing: 1.1,
                        ),
                ),
                if (story.tagline.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    story.tagline,
                    style: GoogleFonts.vazirmatn(
                      fontSize: 12,
                      color: Colors.white60,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
                const SizedBox(height: 12),

                // Synopsis
                Text(
                  story.synopsis,
                  style: isStoryPersian
                      ? GoogleFonts.vazirmatn(
                          fontSize: 13,
                          height: 1.6,
                          color: const Color(0xFFD4D4D8),
                        )
                      : GoogleFonts.merriweather(
                          fontSize: 12.5,
                          height: 1.6,
                          color: const Color(0xFFD4D4D8),
                        ),
                ),
                const SizedBox(height: 16),

                // Genre & RPG Attributes Tags
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final g in story.genres)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E2032),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF3F3F46)),
                        ),
                        child: Text(
                          _formatGenreName(g, isPersian),
                          style: GoogleFonts.vazirmatn(fontSize: 11, color: const Color(0xFFE4E4E7)),
                        ),
                      ),
                    for (final stat in story.statsPreview)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.25)),
                        ),
                        child: Text(
                          stat,
                          style: GoogleFonts.vazirmatn(
                            fontSize: 11,
                            color: const Color(0xFFF59E0B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),

                // Action Button
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isActive ? const Color(0xFF27272A) : const Color(0xFFF59E0B),
                      foregroundColor: isActive ? Colors.white70 : Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: isActive ? 0 : 4,
                    ),
                    onPressed: _startingStoryId != null
                        ? null
                        : () async {
                            if (isActive) {
                              if (Navigator.canPop(context)) {
                                Navigator.of(context).pop();
                              } else {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (context) => const ReaderScreen()),
                                );
                              }
                            } else {
                              CharacterCreationScreen.open(context, story: story);
                            }
                          },
                    child: _startingStoryId == story.id
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.black,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                isPersian ? 'در حال ورود به قلمرو...' : 'Entering Realm...',
                                style: GoogleFonts.vazirmatn(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black,
                                ),
                              ),
                            ],
                          )
                        : Text(
                            isActive
                                ? (isPersian ? 'ادامه خوانش همین داستان' : 'Continue Current Adventure')
                                : (isPersian ? 'آغاز این ماجراجویی' : 'Start This Adventure'),
                            style: GoogleFonts.vazirmatn(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
