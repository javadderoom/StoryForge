import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../services/game_api_service.dart';
import 'story_cover_image.dart';

class StoryCatalogDialog extends StatefulWidget {
  final String activeStoryId;
  final bool isPersian;
  final ValueChanged<String> onSelectStory;

  const StoryCatalogDialog({
    super.key,
    required this.activeStoryId,
    required this.onSelectStory,
    this.isPersian = false,
  });

  static Future<void> show(
    BuildContext context, {
    required String activeStoryId,
    required ValueChanged<String> onSelectStory,
    bool isPersian = false,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'StoryCatalog',
      barrierColor: Colors.black.withValues(alpha: 0.8),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (context, anim1, anim2) {
        return StoryCatalogDialog(
          activeStoryId: activeStoryId,
          onSelectStory: onSelectStory,
          isPersian: isPersian,
        );
      },
      transitionBuilder: (context, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: FadeTransition(opacity: anim1, child: child),
        );
      },
    );
  }

  @override
  State<StoryCatalogDialog> createState() => _StoryCatalogDialogState();
}

class _StoryCatalogDialogState extends State<StoryCatalogDialog> {
  List<dynamic> _stories = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadStories();
  }

  Future<void> _loadStories() async {
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
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: widget.isPersian ? TextDirection.rtl : TextDirection.ltr,
      child: Center(
        child: Material(
          color: Colors.transparent,
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
            padding: const EdgeInsets.all(24),
            constraints: const BoxConstraints(maxWidth: 550, maxHeight: 650),
            decoration: BoxDecoration(
              color: const Color(0xFF10121C),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: const Color(0xFF27272A)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.6),
                  blurRadius: 30,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.auto_stories_rounded, color: Color(0xFFF59E0B), size: 20),
                        const SizedBox(width: 8),
                        Text(
                          widget.isPersian ? 'کتابخانه دنیاها و داستان‌ها' : 'STORYFORGE LIBRARY',
                          style: GoogleFonts.vazirmatn(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white60, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Stories list
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                        )
                      : ListView.separated(
                          itemCount: _stories.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 14),
                          itemBuilder: (context, index) {
                            final story = _stories[index];
                            final isCurrent = story['id'] == widget.activeStoryId;

                            return Container(
                              decoration: BoxDecoration(
                                color: isCurrent
                                    ? const Color(0xFFF59E0B).withValues(alpha: 0.1)
                                    : const Color(0xFF181926),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: isCurrent
                                      ? const Color(0xFFF59E0B).withValues(alpha: 0.6)
                                      : const Color(0xFF27272A),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Story Cover Header
                                  StoryCoverImage(
                                    storyId: story['id'] ?? '',
                                    coverImageUrl: story['coverImageUrl'],
                                    height: 100,
                                    borderRadius: const BorderRadius.vertical(top: Radius.circular(17)),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                story['title'] ?? '',
                                                style: GoogleFonts.vazirmatn(
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.bold,
                                                  color: isCurrent ? const Color(0xFFF59E0B) : Colors.white,
                                                ),
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF27272A),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                (story['language'] ?? 'fa').toUpperCase(),
                                                style: GoogleFonts.vazirmatn(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white70,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          story['tagline'] ?? '',
                                          style: GoogleFonts.vazirmatn(
                                            fontSize: 12,
                                            color: const Color(0xFFF59E0B),
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          story['synopsis'] ?? '',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.vazirmatn(
                                            fontSize: 11,
                                            color: Colors.white60,
                                            height: 1.5,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        SizedBox(
                                          width: double.infinity,
                                          height: 38,
                                          child: ElevatedButton.icon(
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: isCurrent
                                                  ? const Color(0xFFF59E0B).withValues(alpha: 0.2)
                                                  : const Color(0xFF27272A),
                                              foregroundColor: isCurrent ? const Color(0xFFF59E0B) : Colors.white,
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(12),
                                                side: BorderSide(
                                                  color: isCurrent
                                                      ? const Color(0xFFF59E0B).withValues(alpha: 0.5)
                                                      : const Color(0xFF3F3F46),
                                                ),
                                              ),
                                              elevation: 0,
                                            ),
                                            onPressed: () {
                                              widget.onSelectStory(story['id']);
                                              Navigator.of(context).pop();
                                            },
                                            icon: Icon(
                                              isCurrent ? Icons.play_arrow_rounded : Icons.explore_outlined,
                                              size: 18,
                                            ),
                                            label: Text(
                                              isCurrent
                                                  ? (widget.isPersian ? 'ادامه ماجراجویی' : 'Continue Story')
                                                  : (widget.isPersian ? 'شروع این ماجراجویی' : 'Play Story'),
                                              style: GoogleFonts.vazirmatn(
                                                fontSize: 12,
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
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
