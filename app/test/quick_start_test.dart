import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/character_creation.dart';
import 'package:afsanehsaz/models/story.dart';

void main() {
  group('CharacterSetupPayload.quickStart Tests', () {
    test('Correctly auto-appoints all 4 free stat points based on archetype affinities', () {
      final sampleStory = StorySummary(
        id: 'story_mt4ofllt',
        title: 'طلا و لجن',
        tagline: 'داستانی در بادیه هیرام',
        synopsis: 'ماجراجویی در بیابان',
        genres: ['dark_fantasy'],
        language: 'fa',
        coverImageUrl: '',
        author: 'افسانه‌ساز',
        statsPreview: ['زورمندی', 'چابکی'],
        stats: [
          const StoryStatSummary(id: 'might', name: 'زورمندی', description: 'توان بدنی', baseValue: 10),
          const StoryStatSummary(id: 'agility', name: 'چابکی', description: 'سرعت عمل', baseValue: 10),
          const StoryStatSummary(id: 'cunning', name: 'زیرکی', description: 'هوش و ترفند', baseValue: 10),
          const StoryStatSummary(id: 'arcana', name: 'رموز', description: 'دانش کهن', baseValue: 8),
          const StoryStatSummary(id: 'charisma', name: 'گیرایی', description: 'جاذبه کلامی', baseValue: 10),
        ],
        archetypes: [
          const ArchetypeModel(
            id: 'arch_hiram_bladebearer',
            name: 'تیغ‌زن بادیه',
            tagline: 'شمشیرزن کارکشته',
            description: 'جنگجوی بادیه',
            statBonuses: {
              'might': 2,
              'agility': 1,
            },
          ),
        ],
        backgrounds: [
          const BackgroundOriginModel(
            id: 'bg_mercenary',
            name: 'مزدور کاروان',
            description: 'شمشیر اجاره‌ای',
            trait: 'سرسخت',
            statBonuses: {
              'might': 1,
            },
          ),
        ],
      );

      final payload = CharacterSetupPayload.quickStart(sampleStory, isPersian: true);

      expect(payload.archetypeId, equals('arch_hiram_bladebearer'));
      expect(payload.backgroundId, equals('bg_mercenary'));
      expect(payload.characterName, equals('برزین'));

      // Check stat point allocation:
      // Base stats: might 10, agility 10, cunning 10, arcana 8, charisma 10
      // Archetype bonuses: might +2, agility +1
      // Background bonuses: might +1
      // 4 Free points appointed to top affinities: might (primary: +2), agility (secondary: +2)
      // Total Might = 10 (base) + 2 (arch) + 1 (bg) + 2 (appointed) = 15
      // Total Agility = 10 (base) + 1 (arch) + 0 (bg) + 2 (appointed) = 13
      // Total Cunning = 10 (base) + 0 (arch) + 0 (bg) + 0 (appointed) = 10
      // Total Arcana = 8 (base) + 0 (arch) + 0 (bg) + 0 (appointed) = 8
      // Total Charisma = 10 (base) + 0 (arch) + 0 (bg) + 0 (appointed) = 10

      final stats = payload.allocatedStats!;
      expect(stats['might'], equals(15));
      expect(stats['agility'], equals(13));
      expect(stats['cunning'], equals(10));
      expect(stats['arcana'], equals(8));
      expect(stats['charisma'], equals(10));

      final totalAppointed = (stats['might']! - 13) + (stats['agility']! - 11);
      expect(totalAppointed, equals(4), reason: 'All 4 free stat points must be appointed');

      final json = payload.toJson();
      expect(json['archetypeId'], equals('arch_hiram_bladebearer'));
      expect(json['backgroundId'], equals('bg_mercenary'));
      expect(json['characterName'], equals('برزین'));
      expect(json['allocatedStats'], isNotNull);
    });
  });
}
