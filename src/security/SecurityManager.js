const { EventEmitter } = require('events');
const crypto = require('crypto');

class SecurityManager extends EventEmitter {
  constructor() {
    super();
    
    this.policies = {
      blockTrackers: true,
      blockAds: true,
      enforceHTTPS: true,
      blockMalicious: true,
      sandboxThirdParty: true,
      aiDataBoundaries: true
    };
    
    this.blocklists = {
      trackers: new Set(),
      ads: new Set(),
      malicious: new Set()
    };
    
    this.trustedDomains = new Set([
      'localhost',
      '127.0.0.1',
      '::1'
    ]);
    
    this.requestAnalytics = {
      blocked: 0,
      allowed: 0,
      upgraded: 0
    };
  }

  async initialize() {
    console.log('Initializing Security Manager...');
    
    // Load blocklists
    await this.loadBlocklists();
    
    // Initialize local browser isolation
    this.initializeIsolation();
    
    this.emit('initialized');
  }

  async loadBlocklists() {
    // In production, load from EasyList, uBlock Origin lists, etc.
    // For now, add some common trackers
    this.blocklists.trackers.add('google-analytics.com');
    this.blocklists.trackers.add('facebook.com/tr');
    this.blocklists.trackers.add('doubleclick.net');
    
    this.blocklists.ads.add('googlesyndication.com');
    this.blocklists.ads.add('amazon-adsystem.com');
    
    console.log('Blocklists loaded');
  }

  initializeIsolation() {
    // Local browser isolation inspired by Island.io
    this.isolationPolicies = {
      processIsolation: true,
      memoryProtection: true,
      apiRestrictions: true,
      javascriptSandbox: true
    };
  }

  analyzeRequest(details) {
    const url = new URL(details.url);
    const domain = url.hostname;
    
    // Check if trusted
    if (this.trustedDomains.has(domain)) {
      this.requestAnalytics.allowed++;
      return { cancel: false };
    }
    
    // Check blocklists
    if (this.policies.blockTrackers && this.isTracker(url)) {
      this.requestAnalytics.blocked++;
      this.emit('request-blocked', { url: details.url, reason: 'tracker' });
      return { cancel: true };
    }
    
    if (this.policies.blockAds && this.isAd(url)) {
      this.requestAnalytics.blocked++;
      this.emit('request-blocked', { url: details.url, reason: 'ad' });
      return { cancel: true };
    }
    
    if (this.policies.blockMalicious && this.isMalicious(url)) {
      this.requestAnalytics.blocked++;
      this.emit('request-blocked', { url: details.url, reason: 'malicious' });
      return { cancel: true };
    }
    
    // Upgrade to HTTPS if needed
    if (this.policies.enforceHTTPS && url.protocol === 'http:') {
      const httpsUrl = details.url.replace('http:', 'https:');
      this.requestAnalytics.upgraded++;
      return { redirectURL: httpsUrl };
    }
    
    this.requestAnalytics.allowed++;
    return { cancel: false };
  }

  isTracker(url) {
    const domain = url.hostname;
    return Array.from(this.blocklists.trackers).some(tracker => 
      domain.includes(tracker) || url.pathname.includes(tracker)
    );
  }

  isAd(url) {
    const domain = url.hostname;
    return Array.from(this.blocklists.ads).some(ad => 
      domain.includes(ad) || url.pathname.includes(ad)
    );
  }

  isMalicious(url) {
    const domain = url.hostname;
    return this.blocklists.malicious.has(domain);
  }

  async checkUrl(url) {
    try {
      const urlObj = new URL(url);
      
      // Check against various security criteria
      const checks = {
        isSecure: urlObj.protocol === 'https:',
        isTracker: this.isTracker(urlObj),
        isAd: this.isAd(urlObj),
        isMalicious: this.isMalicious(urlObj),
        isTrusted: this.trustedDomains.has(urlObj.hostname)
      };
      
      const riskScore = this.calculateRiskScore(checks);
      
      return {
        url: url,
        checks: checks,
        riskScore: riskScore,
        recommendation: riskScore > 0.5 ? 'block' : 'allow'
      };
    } catch (error) {
      return {
        error: 'Invalid URL',
        recommendation: 'block'
      };
    }
  }

  calculateRiskScore(checks) {
    let score = 0;
    
    if (!checks.isSecure) score += 0.3;
    if (checks.isTracker) score += 0.2;
    if (checks.isAd) score += 0.1;
    if (checks.isMalicious) score += 1.0;
    if (checks.isTrusted) score -= 0.5;
    
    return Math.max(0, Math.min(1, score));
  }

  isUrlSafe(parsedUrl) {
    // Basic safety checks
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    
    if (dangerousProtocols.includes(parsedUrl.protocol)) {
      return false;
    }
    
    if (this.isMalicious(parsedUrl)) {
      return false;
    }
    
    return true;
  }

  // AI-specific security
  async validateAIRequest(request) {
    // Check if request contains sensitive data
    const sensitivePatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /password\s*[:=]\s*\S+/i, // Passwords
    ];
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(request.query)) {
        return {
          allowed: false,
          reason: 'Contains sensitive data'
        };
      }
    }
    
    // Check data boundaries
    if (this.policies.aiDataBoundaries && request.context?.source === 'external') {
      return {
        allowed: false,
        reason: 'External data not allowed in AI queries'
      };
    }
    
    return { allowed: true };
  }

  generateCSP() {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // WebAssembly needs unsafe-eval
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:'],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'self'"],
      'worker-src': ["'self'", 'blob:'], // For WebWorkers
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"]
    };
  }

  getAnalytics() {
    return {
      ...this.requestAnalytics,
      policies: this.policies,
      blocklistSizes: {
        trackers: this.blocklists.trackers.size,
        ads: this.blocklists.ads.size,
        malicious: this.blocklists.malicious.size
      }
    };
  }

  async shutdown() {
    this.blocklists.trackers.clear();
    this.blocklists.ads.clear();
    this.blocklists.malicious.clear();
    this.trustedDomains.clear();
    
    this.emit('shutdown');
  }
}

module.exports = { SecurityManager };