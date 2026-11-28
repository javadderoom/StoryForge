import 'package:flutter_test/flutter_test.dart';
import 'package:afsanehsaz/models/choice_option.dart';

void main() {
  group('ChoiceOption.fromJson', () {
    test('does not corrupt Persian guillemet-wrapped dialogue into \$1', () {
      const inner = 'چهل سکهٔ نقره تا شاخ زرین، ولی نصفش رو هم‌الان تو چاه‌سنگ می‌گیرم.';
      final choice = ChoiceOption.fromJson({
        'id': 'choice_pay_demand',
        'text': '«$inner»',
        'style': 'tactical',
        'riskLevel': 'medium',
      });

      expect(choice.text, equals(inner));
      expect(choice.text.contains(r'$1'), isFalse);
    });

    test('preserves guillemets when preceded by a narrative action prefix', () {
      const full = 'با صدای رسا می‌گویم: «چهل سکهٔ نقره تا شاخ زرین.»';
      final choice = ChoiceOption.fromJson({
        'id': 'choice_1',
        'text': full,
        'style': 'social',
        'riskLevel': 'low',
      });

      expect(choice.text, equals(full));
    });

    test('handles numeric targetDC as double and non-string id safely', () {
      final choice = ChoiceOption.fromJson({
        'id': 42,
        'text': 'بررسی قفل دروازه',
        'targetDC': 13.0,
        'requiredStatId': 'cunning',
      });

      expect(choice.id, equals('42'));
      expect(choice.targetDC, equals(13));
      expect(choice.requiresRoll, isTrue);
      expect(choice.leadIn, isNull);
    });

    test('parses trimmed non-empty leadIn and drops blank strings', () {
      final withLead = ChoiceOption.fromJson({
        'id': 'c1',
        'text': 'دست به قبضه می‌بری',
        'leadIn': '  انگشتانت دور قبضهٔ سرد شمشیر قفل می‌شود و یک گام جلو می‌گذاری...  ',
      });
      expect(
        withLead.leadIn,
        equals('انگشتانت دور قبضهٔ سرد شمشیر قفل می‌شود و یک گام جلو می‌گذاری...'),
      );

      final blankLead = ChoiceOption.fromJson({
        'id': 'c2',
        'text': 'عقب می‌کشی',
        'leadIn': '   ',
      });
      expect(blankLead.leadIn, isNull);
    });
  });
}
