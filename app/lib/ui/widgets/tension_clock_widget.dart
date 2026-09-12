import 'package:flutter/material.dart';
import '../../models/game_state.dart';

/// Plan 13: segmented glowing threat meter (mirrors web TensionClockWidget).
class TensionClockWidget extends StatelessWidget {
  final List<TensionClock> clocks;
  final bool isPersian;

  const TensionClockWidget({super.key, required this.clocks, this.isPersian = true});

  @override
  Widget build(BuildContext context) {
    if (clocks.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: clocks.map((clock) {
        final max = clock.maxSegments < 2 ? 4 : clock.maxSegments;
        final cur = clock.currentSegments.clamp(0, max);
        final nearCrisis = !clock.isTriggered && cur >= max - 1;
        final border = clock.isTriggered
            ? Colors.redAccent
            : nearCrisis
                ? Colors.amber
                : Colors.grey.shade700;
        return Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: clock.isTriggered
                ? Colors.red.shade900.withValues(alpha: 0.7)
                : Colors.grey.shade900.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border.withValues(alpha: 0.7)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${clock.isTriggered ? (isPersian ? 'بحران! ' : 'CRISIS! ') : ''}${clock.name}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: clock.isTriggered
                        ? Colors.red.shade200
                        : nearCrisis
                            ? Colors.amber.shade200
                            : Colors.grey.shade300,
                  ),
                ),
              ),
              Row(
                children: List.generate(max, (i) {
                  final filled = i < cur;
                  return Container(
                    width: 10,
                    height: 12,
                    margin: const EdgeInsets.symmetric(horizontal: 1.5),
                    decoration: BoxDecoration(
                      color: filled
                          ? (clock.isTriggered ? Colors.redAccent : nearCrisis ? Colors.amber : Colors.pinkAccent)
                          : Colors.grey.shade800,
                      borderRadius: BorderRadius.circular(3),
                      border: Border.all(color: filled ? border : Colors.grey.shade700),
                    ),
                  );
                }),
              ),
              const SizedBox(width: 6),
              Text('$cur/$max',
                  style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Colors.grey)),
            ],
          ),
        );
      }).toList(),
    );
  }
}
