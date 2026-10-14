import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/story.dart';
import '../../models/story_character_session.dart';
import '../../providers/game_session_provider.dart';
import '../../services/game_api_service.dart';
import '../widgets/app_toast.dart';
import '../widgets/story_cover_image.dart';
import 'character_creation_screen.dart';
import 'reader_screen.dart';

class StoryCharactersScreen extends ConsumerStatefulWidget {
  final StorySummary story;

  const StoryCharactersScreen({
    super.key,
    required this.story,
  });

  static Future<void> open(BuildContext context, {required StorySummary story}) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => StoryCharactersScreen(story: story),
      ),
    );
  }

  @override
  ConsumerState<StoryCharactersScreen> createState() => _StoryCharactersScreenState();
}

class _StoryCharactersScreenState extends ConsumerState<StoryCharactersScreen> {
  List<StoryCharacterSession> _characters = [];
  bool _isLoading = true;
  String? _errorMessage;
  String? _resumingSessionId;
  String? _deletingSessionId;

  @override
  void initState() {
    super.initState();
    _loadCharacters();
  }

  Future<void> _loadCharacters() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final sessions = await GameApiService.fetchStorySessions(widget.story.id);
      if (mounted) {
        setState(() {
          _characters = sessions;
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

  Future<void> _resumeCharacter(StoryCharacterSession char) async {
    if (_resumingSessionId != null) return;
    setState(() => _resumingSessionId = char.sessionId);

    final ok = await ref.read(gameSessionProvider.notifier).resumeStory(
          widget.story.id,
          sessionId: char.sessionId,
        );

    if (mounted) {
      setState(() => _resumingSessionId = null);
      if (ok) {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ReaderScreen()),
        );
      } else {
        AppToast.error(
          context,
          widget.story.language == 'en'
              ? 'Failed to resume character session.'
              : 'خطا در بارگذاری ماجراجویی این شخصیت.',
        );
      }
    }
  }

  Future<void> _confirmDeleteCharacter(StoryCharacterSession char, bool isPersian) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
        child: AlertDialog(
          backgroundColor: const Color(0xFF131524),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: Color(0xFF3F3F46)),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  isPersian ? 'حذف شخصیت' : 'Delete Character',
                  style: GoogleFonts.vazirmatn(
                    fontSize: 16,
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
                    ? 'آیا از حذف شخصیت «${char.characterName}» اطمینان دارید؟'
                    : 'Are you sure you want to delete "${char.characterName}"?',
                style: GoogleFonts.vazirmatn(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        isPersian
                            ? 'تمام پیشرفت این شخصیت پاک خواهد شد و هیچ اعتباری مسترد نمی‌گردد.'
                            : 'All progress for this character will be permanently erased. No credits are refunded.',
                        style: GoogleFonts.vazirmatn(fontSize: 11.5, color: const Color(0xFFFCA5A5)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actionsPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(
                isPersian ? 'انصراف' : 'Cancel',
                style: GoogleFonts.vazirmatn(color: Colors.white70),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFEF4444),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(
                isPersian ? 'حذف قطعی' : 'Delete',
                style: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _deletingSessionId = char.sessionId);
    final success = await ref.read(gameSessionProvider.notifier).deleteStorySession(
          char.sessionId,
          storyId: widget.story.id,
        );

    if (mounted) {
      setState(() => _deletingSessionId = null);
      if (success) {
        AppToast.show(
          context,
          message: isPersian
              ? 'شخصیت «${char.characterName}» با موفقیت حذف شد.'
              : 'Character "${char.characterName}" deleted.',
          type: ToastType.success,
        );
        _loadCharacters();
      } else {
        AppToast.error(
          context,
          isPersian ? 'خطا در حذف شخصیت.' : 'Failed to delete character.',
        );
      }
    }
  }

  void _openCharacterCreation() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CharacterCreationScreen(story: widget.story),
      ),
    ).then((_) {
      if (mounted) {
        _loadCharacters();
      }
    });
  }

  String _formatRelativeDate(DateTime? date, bool isPersian) {
    if (date == null) return '';
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) {
      return isPersian ? 'همین الان' : 'Just now';
    } else if (diff.inMinutes < 60) {
      final m = diff.inMinutes;
      return isPersian ? '${PersianNumbers.toPersian(m)} دقیقه قبل' : '$m min ago';
    } else if (diff.inHours < 24) {
      final h = diff.inHours;
      return isPersian ? '${PersianNumbers.toPersian(h)} ساعت قبل' : '$h hr ago';
    } else {
      final d = diff.inDays;
      return isPersian ? '${PersianNumbers.toPersian(d)} روز قبل' : '$d days ago';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPersian = widget.story.language == 'fa' ||
        widget.story.language == 'farsi' ||
        RegExp(r'[\u0600-\u06FF]').hasMatch(widget.story.title);

    return Directionality(
      textDirection: isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        backgroundColor: const Color(0xFF090A10),
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F111D),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFFF59E0B), size: 20),
            tooltip: isPersian ? 'بازگشت' : 'Back',
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Text(
            isPersian ? 'شخصیت‌های ماجراجویی' : 'CHRONICLE CHARACTERS',
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
              tooltip: isPersian ? 'به‌روزرسانی' : 'Refresh',
              onPressed: _loadCharacters,
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: _isLoading
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.5),
                            width: 2,
                          ),
                        ),
                        child: const Center(
                          child: SizedBox(
                            width: 26,
                            height: 26,
                            child: CircularProgressIndicator(
                              color: Color(0xFFF59E0B),
                              strokeWidth: 2.5,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        isPersian ? 'در حال فراخوانی سرگذشت‌ها...' : 'Loading character chronicles...',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                )
              : _errorMessage != null && _characters.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
                            const SizedBox(height: 16),
                            Text(
                              isPersian ? 'خطا در دریافت فهرست شخصیت‌ها' : 'Error Loading Characters',
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
                                isPersian ? 'تلاش دوباره' : 'Try Again',
                                style: GoogleFonts.vazirmatn(fontWeight: FontWeight.bold),
                              ),
                              onPressed: _loadCharacters,
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView(
                      padding: EdgeInsets.only(
                        left: 20,
                        right: 20,
                        top: 20,
                        bottom: 24 + MediaQuery.of(context).padding.bottom,
                      ),
                      children: [
                        // Story Header Card
                        _buildStoryHeader(isPersian),
                        const SizedBox(height: 24),

                        // Section Title & Create Button
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isPersian ? 'شخصیت‌های فعال شما' : 'Your Active Characters',
                              style: GoogleFonts.vazirmatn(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            if (_characters.isNotEmpty)
                              Directionality(
                                textDirection: TextDirection.ltr,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF1E2032),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFF3F3F46)),
                                  ),
                                  child: Text(
                                    '${_characters.length} Slot${_characters.length > 1 ? 's' : ''}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFFF59E0B),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // Empty State or List of Character Cards
                        if (_characters.isEmpty)
                          _buildEmptyState(isPersian)
                        else
                          for (final char in _characters) ...[
                            _buildCharacterCard(char, isPersian),
                            const SizedBox(height: 14),
                          ],

                        const SizedBox(height: 12),

                        // Add New Character Button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: Colors.black,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              elevation: 4,
                            ),
                            icon: const Icon(Icons.add_rounded, size: 20),
                            label: Text(
                              isPersian ? 'ساخت شخصیت جدید' : 'Forge New Character',
                              style: GoogleFonts.vazirmatn(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            onPressed: _openCharacterCreation,
                          ),
                        ),
                      ],
                    ),
        ),
      ),
    );
  }

  Widget _buildStoryHeader(bool isPersian) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StoryCoverImage(
            storyId: widget.story.id,
            coverImageUrl: widget.story.coverImageUrl,
            height: 130,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(19)),
            heroTag: 'story_cover_characters_${widget.story.id}',
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.story.title,
                  style: isPersian
                      ? GoogleFonts.vazirmatn(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF59E0B),
                        )
                      : GoogleFonts.cinzel(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFF59E0B),
                          letterSpacing: 1.1,
                        ),
                ),
                if (widget.story.tagline.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    widget.story.tagline,
                    style: GoogleFonts.vazirmatn(
                      fontSize: 11.5,
                      color: Colors.white60,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isPersian) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.person_add_alt_1_rounded, color: Color(0xFFF59E0B), size: 36),
          ),
          const SizedBox(height: 16),
          Text(
            isPersian ? 'هنوز شخصیتی برای این داستان نساخته‌اید' : 'No characters forged for this story yet',
            style: GoogleFonts.vazirmatn(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isPersian
                ? 'شما می‌توانید با ساخت چندین شخصیت، مسیرها و انتخاب‌های گوناگون را تجربه کنید.'
                : 'Forge distinct characters to explore multiple paths, classes, and storylines independently.',
            textAlign: TextAlign.center,
            style: GoogleFonts.vazirmatn(fontSize: 11.5, color: Colors.white60, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildCharacterCard(StoryCharacterSession char, bool isPersian) {
    final isResuming = _resumingSessionId == char.sessionId;
    final isDeleting = _deletingSessionId == char.sessionId;
    final timeStr = _formatRelativeDate(char.updatedAt ?? char.createdAt, isPersian);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF121422),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF27272A)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Character Title & Delete Action
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Avatar badge
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.4)),
                  ),
                  child: Center(
                    child: Text(
                      char.characterName.isNotEmpty ? char.characterName.characters.first : '?',
                      style: GoogleFonts.vazirmatn(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFF59E0B),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        char.characterName,
                        style: GoogleFonts.vazirmatn(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${char.archetypeName} • ${char.backgroundName}',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 11.5,
                          color: const Color(0xFFF59E0B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                // Delete button
                IconButton(
                  icon: isDeleting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFFEF4444),
                          ),
                        )
                      : const Icon(Icons.delete_outline_rounded, color: Color(0xFF71717A), size: 20),
                  tooltip: isPersian ? 'حذف شخصیت' : 'Delete Character',
                  onPressed: isDeleting || isResuming ? null : () => _confirmDeleteCharacter(char, isPersian),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Metadata Chips (Level, Turn Count, Last Played)
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E2032),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF3F3F46)),
                  ),
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      isPersian
                          ? 'سطح ${PersianNumbers.toPersian(char.level)}'
                          : 'Level ${char.level}',
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFE4E4E7),
                      ),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E2032),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF3F3F46)),
                  ),
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      isPersian
                          ? 'صحنه ${PersianNumbers.toPersian(char.turnCount)}'
                          : 'Scene ${char.turnCount}',
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFE4E4E7),
                      ),
                    ),
                  ),
                ),
                if (timeStr.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF18181B),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.access_time_rounded, size: 11, color: Colors.white38),
                        const SizedBox(width: 4),
                        Text(
                          timeStr,
                          style: GoogleFonts.vazirmatn(fontSize: 10.5, color: Colors.white54),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),

            // Resume Adventure Button
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF27272A),
                  foregroundColor: const Color(0xFFFDE68A),
                  side: const BorderSide(color: Color(0xFFF59E0B), width: 1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: isResuming || isDeleting ? null : () => _resumeCharacter(char),
                child: isResuming
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFFF59E0B),
                            ),
                          ),
                          SizedBox(width: 10),
                          Text(
                            'در حال احضار سرگذشت...',
                            style: TextStyle(fontSize: 12, color: Color(0xFFFDE68A)),
                          ),
                        ],
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.play_arrow_rounded, color: Color(0xFFF59E0B), size: 18),
                          const SizedBox(width: 6),
                          Text(
                            isPersian ? 'ادامه ماجراجویی با این شخصیت' : 'Continue with this Character',
                            style: GoogleFonts.vazirmatn(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFFFDE68A),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
