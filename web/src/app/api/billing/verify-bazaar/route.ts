import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/getUser';
import { getPrisma } from '@/lib/db/client';
import { DEFAULT_CREDIT_PACKAGES } from '@/lib/billing/packages';

const BAZAAR_PACKAGE_NAME = process.env.BAZAAR_PACKAGE_NAME || 'com.afsanehsaz.app';
const BAZAAR_CLIENT_ID = process.env.BAZAAR_CLIENT_ID;
const BAZAAR_CLIENT_SECRET = process.env.BAZAAR_CLIENT_SECRET;
const BAZAAR_REFRESH_TOKEN = process.env.BAZAAR_REFRESH_TOKEN;

/**
 * Validates purchase token with Cafe Bazaar Open API and auto-consumes consumable credit packs
 */
async function verifyWithBazaarApi(
  sku: string,
  purchaseToken: string
): Promise<{ isValid: boolean; rawResponse?: any; error?: string }> {
  if (!BAZAAR_CLIENT_ID || !BAZAAR_CLIENT_SECRET || !BAZAAR_REFRESH_TOKEN) {
    // In dev / unconfigured environments, allow test tokens
    if (process.env.NODE_ENV !== 'production' || purchaseToken.startsWith('mock_bazaar_') || purchaseToken.startsWith('bazaar_tok_')) {
      return { isValid: true, rawResponse: { mode: 'dev_mock', purchaseState: 0, consumed: true } };
    }
    return { isValid: false, error: 'Bazaar IAP credentials not configured on server.' };
  }

  try {
    // 1. Get fresh access token from Bazaar
    const tokenRes = await fetch('https://pardakht.cafebazaar.ir/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: BAZAAR_CLIENT_ID,
        client_secret: BAZAAR_CLIENT_SECRET,
        refresh_token: BAZAAR_REFRESH_TOKEN,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return { isValid: false, error: 'Failed to refresh Bazaar access token.' };
    }

    // 2. Validate product purchase
    const verifyUrl = `https://pardakht.cafebazaar.ir/open_api/v2/applications/${BAZAAR_PACKAGE_NAME}/purchases/products/${sku}/tokens/${purchaseToken}/`;
    const verifyRes = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const verifyData = await verifyRes.json();
    // purchaseState: 0 = Purchased, 1 = Refunded
    if (verifyRes.ok && verifyData.purchaseState === 0) {
      // 3. Auto-consume consumable product on Bazaar server so pack can be bought again
      let consumed = false;
      try {
        const consumeUrl = `https://pardakht.cafebazaar.ir/open_api/v2/applications/${BAZAAR_PACKAGE_NAME}/purchases/products/${sku}/tokens/${purchaseToken}/consume/`;
        const consumeRes = await fetch(consumeUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        consumed = consumeRes.ok;
      } catch (consumeErr) {
        console.warn('Bazaar server-side consume call failed (client may consume):', consumeErr);
      }

      return { isValid: true, rawResponse: { ...verifyData, consumed } };
    }

    return { isValid: false, error: 'Invalid or expired Bazaar purchase token.', rawResponse: verifyData };
  } catch (err: any) {
    console.error('Error connecting to Cafe Bazaar API:', err);
    return { isValid: false, error: err.message || 'Bazaar API network error' };
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in to redeem credits.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { sku, purchaseToken, packageId } = body;

    if (!sku || !purchaseToken) {
      return NextResponse.json(
        { success: false, error: 'sku and purchaseToken are required.' },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, error: 'Database service is currently unavailable.' },
        { status: 503 }
      );
    }

    // Match credit package from database (fallback to defaults)
    let pack = await prisma.creditPackage.findFirst({
      where: { OR: [{ sku }, { id: packageId }], isActive: true },
    });

    if (!pack) {
      pack = (DEFAULT_CREDIT_PACKAGES.find((p) => p.sku === sku) as any) ?? null;
    }

    if (!pack) {
      return NextResponse.json(
        { success: false, error: `Invalid SKU or package: ${sku}` },
        { status: 400 }
      );
    }

    // Check for replay attack / duplicate token
    const alreadyRedeemed = await prisma.bazaarPurchase.findUnique({
      where: { token: purchaseToken },
    });

    if (alreadyRedeemed) {
      return NextResponse.json(
        { success: false, error: 'This purchase has already been claimed and credited.' },
        { status: 409 }
      );
    }

    // Verify with Bazaar
    const verification = await verifyWithBazaarApi(sku, purchaseToken);
    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Bazaar purchase validation failed.' },
        { status: 400 }
      );
    }

    // Atomically credit user account
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: auth.user.id },
        data: {
          creditBalance: { increment: pack.credits },
        },
      });

      await tx.bazaarPurchase.create({
        data: {
          userId: auth.user.id,
          sku: pack.sku,
          token: purchaseToken,
          status: 'COMPLETED',
          amountPaidRial: pack.priceRial,
          creditsAwarded: pack.credits,
          rawResponse: verification.rawResponse ?? {},
        },
      });

      await tx.userCreditLedger.create({
        data: {
          userId: auth.user.id,
          amount: pack.credits,
          balanceAfter: updatedUser.creditBalance,
          reason: 'BAZAAR_PURCHASE',
          metadata: {
            sku: pack.sku,
            packageTitle: pack.title,
            purchaseToken,
          },
        },
      });

      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      data: {
        newBalance: result.creditBalance,
        creditsAwarded: pack.credits,
        packageTitle: pack.title,
        message: `موجودی شما با موفقیت ${pack.credits} صحنه افزایش یافت!`,
      },
    });
  } catch (error: any) {
    console.error('Bazaar verification handler error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error during purchase verification.' },
      { status: 500 }
    );
  }
}
