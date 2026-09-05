import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/utils/persian_numbers.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../../services/audio_service.dart';
import '../../services/bazaar_billing_service.dart';
import '../../services/billing_service.dart';
import 'auth_screen.dart';

class ShopScreen extends ConsumerStatefulWidget {
  const ShopScreen({super.key});

  static Future<void> open(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const ShopScreen(),
    );
  }

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  List<CreditPackage> _packages = [];
  bool _isLoading = true;
  String? _purchasingPackageId;

  @override
  void initState() {
    super.initState();
    _loadPackages();
    BazaarBillingService().init();
  }

  @override
  void dispose() {
    BazaarBillingService().dispose();
    super.dispose();
  }

  Future<void> _loadPackages() async {
    setState(() => _isLoading = true);
    final list = await BillingService.fetchPackages();
    if (mounted) {
      setState(() {
        _packages = list;
        _isLoading = false;
      });
    }
  }

  void _handlePurchase(CreditPackage pack) async {
    final authState = ref.read(authProvider);

    if (!authState.isAuthenticated) {
      AudioService().playSfx(SfxType.buttonClick);
      final loggedIn = await AuthScreen.open(context);
      if (loggedIn != true) return;
    }

    setState(() => _purchasingPackageId = pack.id);
    AudioService().playSfx(SfxType.buttonClick);

    // Cafe Bazaar In-App Purchase Flow (Native via Poolakey with simulation fallback)
    final result = await BazaarBillingService().purchaseProduct(
      sku: pack.sku,
      packageId: pack.id,
    );

    if (mounted) {
      setState(() => _purchasingPackageId = null);

      if (result.success) {
        AudioService().playSfx(SfxType.diceSuccess);
        final newBalance = result.newBalance ?? (authState.user?.creditBalance ?? 0) + pack.credits;
        ref.read(authProvider.notifier).updateCreditBalance(newBalance);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text(
              result.message ?? 'خرید با موفقیت انجام شد! ${pack.credits} صحنه به حسابتان اضافه شد.',
              style: GoogleFonts.vazirmatn(),
            ),
          ),
        );
      } else {
        AudioService().playSfx(SfxType.diceFail);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text(
              result.error ?? 'خطا در انجام تراکنش کافه‌بازار.',
              style: GoogleFonts.vazirmatn(),
            ),
          ),
        );
      }
    }
  }

  String _formatNumber(int val) {
    return PersianNumbers.toPersian(val.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]},',
        ));
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final currentCredits = user?.creditBalance ?? 0;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        height: MediaQuery.of(context).size.height * 0.85,
        padding: const EdgeInsets.only(top: 16, left: 20, right: 20, bottom: 20),
        decoration: const BoxDecoration(
          color: Color(0xFF0A0C16),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: Color(0xFF272A3C), width: 1.5)),
        ),
        child: Column(
          children: [
            // Handle Drag Bar
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),

            // Header Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.auto_awesome_mosaic_rounded, color: Color(0xFFF59E0B), size: 24),
                    const SizedBox(width: 8),
                    Text(
                      'فروشگاه صحنه‌های داستانی',
                      style: GoogleFonts.vazirmatn(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFF59E0B),
                      ),
                    ),
                  ],
                ),
                // Credit Balance Pill
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.bolt, color: Color(0xFFF59E0B), size: 16),
                      const SizedBox(width: 4),
                      Text(
                        'موجودی: ${PersianNumbers.toPersian(currentCredits)} صحنه',
                        style: GoogleFonts.vazirmatn(
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFFBBF24),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Cafe Bazaar Badge Notice
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF13172B),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF232845)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shopping_bag_outlined, color: Color(0xFF10B981), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'پرداخت امن و آنی از طریق درگاه پرداخت کافه‌بازار',
                      style: GoogleFonts.vazirmatn(fontSize: 12, color: const Color(0xFFA1A1AA)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Packages List
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
                    )
                  : ListView.separated(
                      itemCount: _packages.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 14),
                      itemBuilder: (context, index) {
                        final pack = _packages[index];
                        final isPurchasing = _purchasingPackageId == pack.id;
                        final hasBadge = pack.badge != null && pack.badge!.isNotEmpty;

                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF13172B),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: hasBadge ? const Color(0xFFF59E0B) : const Color(0xFF232845),
                              width: hasBadge ? 1.5 : 1.0,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: const Icon(Icons.auto_stories, color: Color(0xFFF59E0B), size: 20),
                                      ),
                                      const SizedBox(width: 10),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            pack.title,
                                            style: GoogleFonts.vazirmatn(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white,
                                            ),
                                          ),
                                          Text(
                                            '${PersianNumbers.toPersian(pack.credits)} صحنه روایت تعاملی هوش مصنوعی',
                                            style: GoogleFonts.vazirmatn(
                                              fontSize: 12,
                                              color: const Color(0xFF94A3B8),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  if (hasBadge)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF59E0B),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        pack.badge!,
                                        style: GoogleFonts.vazirmatn(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.bold,
                                          color: const Color(0xFF0F111D),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                pack.description,
                                style: GoogleFonts.vazirmatn(fontSize: 12.5, color: const Color(0xFFCBD5E1)),
                              ),
                              const SizedBox(height: 14),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '${_formatNumber(pack.priceToman)} تومان',
                                    style: GoogleFonts.vazirmatn(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFFFBBF24),
                                    ),
                                  ),
                                  ElevatedButton(
                                    onPressed: isPurchasing ? null : () => _handlePurchase(pack),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFF59E0B),
                                      foregroundColor: const Color(0xFF0F111D),
                                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                      elevation: 0,
                                    ),
                                    child: isPurchasing
                                        ? const SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F111D)),
                                          )
                                        : Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.shopping_cart_checkout_rounded, size: 16),
                                              const SizedBox(width: 6),
                                              Text(
                                                'خرید با کافه‌بازار',
                                                style: GoogleFonts.vazirmatn(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                            ],
                                          ),
                                  ),
                                ],
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
    );
  }
}
