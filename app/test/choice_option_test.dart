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
  });
}
