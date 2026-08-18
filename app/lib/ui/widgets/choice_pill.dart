import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../models/choice_option.dart';

class ChoicePill extends StatelessWidget {
  final ChoiceOption choice;
  final VoidCallback onTap;

  const ChoicePill({
    super.key,
    required this.choice,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        decoration: BoxDecoration(
          color: const Color(0xFF141522),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFF27272A),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          choice.text,
          textAlign: TextAlign.start,
          style: GoogleFonts.vazirmatn(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: const Color(0xFFF4F4F5),
            height: 1.5,
          ),
        ),
      ),
    );
  }
}
