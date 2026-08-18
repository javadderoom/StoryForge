import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:storyforge/main.dart';

void main() {
  testWidgets('StoryForge initial widget render test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: StoryForgeApp(),
      ),
    );

    expect(find.byType(StoryForgeApp), findsOneWidget);
  });
}
