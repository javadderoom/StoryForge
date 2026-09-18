import 'package:flutter_poolakey/flutter_poolakey.dart';

class ProductItem {
  final String id;
  final String icon;
  final bool consumable;
  SkuDetails? skuDetails;
  PurchaseInfo? purchaseInfo;

  ProductItem(this.id, this.icon, this.consumable);
}

class TrialSubscription extends SkuDetails {
  bool isAvailable = false;
  int trialPeriodDays = 0;
  TrialSubscription(
      super.sku, super.type, super.price, super.title, super.description);

  static TrialSubscription fromSkuDetails(SkuDetails skuDetails) {
    return TrialSubscription(skuDetails.sku, skuDetails.type, skuDetails.price,
        skuDetails.title, skuDetails.description);
  }
}
