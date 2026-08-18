import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'ui/screens/reader_screen.dart';

void main() {
  runApp(
    const ProviderScope(
      child: StoryForgeApp(),
    ),
  );
}

class StoryForgeApp extends StatelessWidget {
  const StoryForgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'StoryForge',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkVoid,
      home: const ReaderScreen(),
    );
  }
}
