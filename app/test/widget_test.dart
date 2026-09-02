import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:afsanehsaz/main.dart';

void main() {
  testWidgets('AfsanehSaz initial widget render test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: AfsanehSazApp(),
      ),
    );

    expect(find.byType(AfsanehSazApp), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 2500));
  });
}
