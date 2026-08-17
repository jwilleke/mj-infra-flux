# Security Vulnerabilities Report

__nerdsbythehour.com__ - ZeroThreat Scan (December 11, 2025)

---

## Summary

- __Overall Risk Level__: Medium
- __Total Vulnerabilities__: 46 (39 Medium, 3 Low, 3 Information)
- __Compliance Status__: OWASP Top 10 (Fail), HIPAA (Fail), PCI DSS (Fail), ISO 27001-A (Fail), GDPR (Pass)

---

## Prioritized Vulnerabilities & Recommendations

### =4 PRIORITY 1: MEDIUM SEVERITY (Implement Immediately)

#### 1. Content Security Policy Not Implemented (24 instances)

__Risk Factor__: Medium | __CVSS Score__: 3.1
__Impact__: Allows XSS attacks, data injection, and clickjacking

__Recommendation__:

- Implement a robust Content Security Policy header on all responses
- Start with a restrictive policy and gradually relax as needed:

  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'
  ```

- Remove inline scripts and styles; use external files with nonces
- Test policy thoroughly before enforcing to avoid breaking functionality
- Monitor CSP violations in real-time

---

#### 2. ClickJacking / Improper Restriction of Rendered UI Layers (15 instances)

__Risk Factor__: Medium | __CVSS Score__: 5.4
__Impact__: Allows framing attacks to trick users into unwanted actions

__Recommendation__:

- Add X-Frame-Options header to prevent clickjacking:

  ```
  X-Frame-Options: SAMEORIGIN
  ```

- Implement frame-busting JavaScript as additional protection
- Consider Content Security Policy `frame-ancestors 'self'` directive
- Apply to all pages, especially admin and sensitive areas
- Verify it doesn't break legitimate iframe embeds

---

#### 3. Insecure Access-Control-Allow-Origin Header (7 instances)

__Risk Factor__: Medium | __CVSS Score__: 3.1
__Impact__: Allows unauthorized cross-origin access to sensitive data

__Recommendation__:

- __CRITICAL__: Never use wildcard (`*`) in Access-Control-Allow-Origin for authenticated endpoints
- Define explicit trusted domains:

  ```
  Access-Control-Allow-Origin: https://trusted-domain.com
  ```

- Remove dynamic origin reflection if present
- If credentials are allowed, explicitly specify origin:

  ```
  Access-Control-Allow-Origin: https://specific-domain.com
  Access-Control-Allow-Credentials: true
  ```

- Only allow CORS on endpoints that absolutely require it
- Review `/assets/` directory CORS configuration immediately

---

### =� PRIORITY 2: LOW SEVERITY (Implement Soon)

#### 4. Strict Transport Security Not Enforced (15 instances)

__Risk Factor__: Low | __CVSS Score__: 6.5
__Impact__: Vulnerability to man-in-the-middle attacks and eavesdropping

__Recommendation__:

- Enable HSTS with appropriate max-age:

  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  ```

- Use `max-age=31536000` (1 year) for production
- Include `preload` directive to add domain to HSTS preload list
- Test HSTS in staging before production deployment
- Consider gradual rollout: start with lower max-age (e.g., 300 seconds)

---

#### 5. X-Content-Type-Options Header Missing (24 instances)

__Risk Factor__: Low | __CVSS Score__: 3.1
__Impact__: Browser MIME-type sniffing can lead to XSS attacks

__Recommendation__:

- Add X-Content-Type-Options header to all responses:

  ```
  X-Content-Type-Options: nosniff
  ```

- Ensure all resources have correct Content-Type headers
- Apply globally via middleware/server configuration
- Verify CSS files return `Content-Type: text/css`
- Verify JS files return `Content-Type: application/javascript`

---

### 9 PRIORITY 3: INFORMATION LEVEL (Address)

#### 6. Email Address Disclosed (2 instances)

__Risk Factor__: Information | __Location__: `/speed` and `/speed/assets/js/app-2.5.4.min.js`
__Impact__: Exposed emails vulnerable to spam and phishing

__Recommendation__:

- Remove email addresses from source code and minified JS files
- Check the `/speed` page and `app-2.5.4.min.js` for exposed email addresses
- Move email contact info to server-side rendering or obfuscate in client code
- Use contact forms with server-side processing instead of visible emails
- If needed, implement email obfuscation JavaScript library
- Scan all minified files for exposed sensitive data

---

#### 7. TRACE/TRACK Method Detected (1 instance)

__Risk Factor__: Information | __CVSS Score__: 5.3
__Impact__: Exposes headers and session data for reconnaissance

__Recommendation__:

- Disable HTTP TRACE and TRACK methods on web server
- For Apache, add to configuration:

  ```
  TraceEnable Off
  ```

- For Nginx, explicitly allow only needed methods:

  ```
  if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS)$) {
    return 405;
  }
  ```

- Verify in staging: `curl -X TRACE https://nerdsbythehour.com/` should return 405

---

## Additional Findings

### Mail Configuration Status

- __2 Failures__ (SMTP Reverse DNS Mismatch, SMTP Transaction Time)
- __6 Passes__ (DKIM, DMARC, SPF, TLS, Anti-spoofing)

__Recommendation__:

- Investigate SMTP reverse DNS mismatch
- Test mail server connectivity
- Verify DMARC/SPF/DKIM configuration is correct

### SSL Certificate

- __Status__: A (Excellent)
- __Valid Until__: 2026-02-15
- __Protocols__: TLS 1.2, TLS 1.3
- __Action__: None needed; certificate is well-configured

### JavaScript Packages

- React-Dom: 19.2.0 
- React Router: 7.9.5 
- __Status__: No known vulnerabilities detected

---

## Compliance Impact

| Standard | Status | Issues |
|----------|--------|--------|
| OWASP Top 10 | __FAIL__ | A1 (Access Control), A4 (Insecure Design), A5 (Security Misconfiguration), A7 (Auth Failure) |
| HIPAA | __FAIL__ | Missing encryption/protection controls |
| GDPR | __PASS__ |  |
| PCI DSS | __FAIL__ | Requirement 4.1 (Strong Cryptography) |
| ISO 27001-A | __FAIL__ | Missing security headers and controls |

---

## Implementation Roadmap

### Week 1 (Critical)

- [ ] Implement Content Security Policy
- [ ] Add X-Frame-Options header
- [ ] Fix CORS configuration
- [ ] Remove/obfuscate email addresses

### Week 2 (High Priority)

- [ ] Enable Strict-Transport-Security
- [ ] Add X-Content-Type-Options header
- [ ] Disable TRACE/TRACK methods
- [ ] Fix SMTP configuration

### Ongoing

- [ ] Set up regular security scanning
- [ ] Update dependencies when vulnerabilities are found
- [ ] Monitor HSTS preload status
- [ ] Review CSP violations monthly

---

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HTTP Strict Transport Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [X-Frame-Options Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
- [CORS Security Issues](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
