import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';

export async function POST(request: NextRequest) {
  try {
    const { domain } = await request.json();

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

    // Check SPF
    let spfStatus = 'MISSING';
    let spfRecord = null;
    let spfRecommendation = '';
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      const spf = txtRecords.flat().find((r) => r.startsWith('v=spf1'));
      if (spf) {
        spfRecord = spf;
        spfStatus = 'PASS';
        if (!spf.includes('include:_spf.google.com') && !spf.includes('include:googlemail.com')) {
          spfRecommendation = 'Consider adding "include:_spf.google.com" for Google Workspace.';
        }
      } else {
        spfRecommendation = 'Add a TXT record: v=spf1 include:_spf.google.com ~all';
      }
    } catch {
      spfStatus = 'FAIL';
      spfRecommendation = 'No TXT records found. Add: v=spf1 include:_spf.google.com ~all';
    }

    // Check DKIM (try common selectors)
    let dkimStatus = 'MISSING';
    const dkimSelectors = ['google', 'default', 'selector1', 'selector2', 'dkim', 'mail'];
    let dkimSelector = '';
    for (const selector of dkimSelectors) {
      try {
        const dkimRecords = await dns.resolveTxt(`${selector}._domainkey.${cleanDomain}`);
        if (dkimRecords.length > 0) {
          dkimStatus = 'PASS';
          dkimSelector = selector;
          break;
        }
      } catch {
        continue;
      }
    }

    const dkimRecommendation = dkimStatus === 'MISSING'
      ? 'Set up DKIM in Google Admin Console: Apps → Google Workspace → Gmail → Authenticate email'
      : `DKIM found with selector: ${dkimSelector}`;

    // Check DMARC
    let dmarcStatus = 'MISSING';
    let dmarcRecord = null;
    let dmarcRecommendation = '';
    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const dmarc = dmarcRecords.flat().find((r) => r.startsWith('v=DMARC1'));
      if (dmarc) {
        dmarcRecord = dmarc;
        dmarcStatus = 'PASS';
        if (dmarc.includes('p=none')) {
          dmarcRecommendation = 'DMARC is in monitor mode (p=none). Consider upgrading to p=quarantine after monitoring.';
        }
      } else {
        dmarcRecommendation = 'Add a TXT record at _dmarc.' + cleanDomain + ': v=DMARC1; p=none; rua=mailto:dmarc@' + cleanDomain;
      }
    } catch {
      dmarcStatus = 'FAIL';
      dmarcRecommendation = 'Add: _dmarc.' + cleanDomain + ' TXT "v=DMARC1; p=none; rua=mailto:dmarc@' + cleanDomain + '"';
    }

    // Check MX records
    let mxRecords: string[] = [];
    try {
      const mx = await dns.resolveMx(cleanDomain);
      mxRecords = mx.sort((a, b) => a.priority - b.priority).map((r) => `${r.priority} ${r.exchange}`);
    } catch {
      // No MX records
    }

    const overallScore = [spfStatus, dkimStatus, dmarcStatus].filter((s) => s === 'PASS').length;
    const scoreLabel = overallScore === 3 ? 'Excellent' : overallScore === 2 ? 'Good' : overallScore === 1 ? 'Fair' : 'Poor';

    return NextResponse.json({
      domain: cleanDomain,
      score: overallScore,
      scoreLabel,
      spf: { status: spfStatus, record: spfRecord, recommendation: spfRecommendation },
      dkim: { status: dkimStatus, selector: dkimSelector, recommendation: dkimRecommendation },
      dmarc: { status: dmarcStatus, record: dmarcRecord, recommendation: dmarcRecommendation },
      mx: mxRecords,
    });
  } catch (error) {
    console.error('Domain check error:', error);
    return NextResponse.json({ error: 'Domain check failed' }, { status: 500 });
  }
}
