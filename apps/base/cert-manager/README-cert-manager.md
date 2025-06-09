# cert-manager

## cert-manager prep

Must have externally resolvable host name for this to work.

## Internal Certs do not work

Try Setup <www.nerdsbythehour.com> as a subdomain for internal networks.
  Reason:      Error accepting authorization: acme: authorization error for <www.nerdsbythehour.com>: 400 urn:ietf:params:acme:error:dns: no valid A records found for <www.nerdsbythehour.com>; no valid AAAA records found for <www.nerdsbythehour.com>

## deby setup Broken

Need DNS for deby.nerdsbythehour.com t Cloudflare (2factor faile dot let me in as change3d phones)

### Might be an answer?

Smallstep is a opensource CA that supports ACME protocol. Combined with pihole this could be a solution.

<https://github.com/smallstep/step-issuer#installing-from-source>

Try setting up nerdsbythehour.com with IP of 192.168.3.51 But can not use IP as vsalue for certificate under let's encrypt.

## Apply certificate to an Ingress

<https://cert-manager.io/docs/usage/ingress/>

see: k8s/apps/whoami/base/whoami-ingress-certificate.yaml

``` yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    # add an annotation indicating the issuer to use.
    cert-manager.io/cluster-issuer: nameOfClusterIssuer
  name: myIngress
  namespace: myIngress
spec:
  tls: # < placing a host in the TLS config will determine what ends up in the cert's subjectAltNames
  - hosts:
    - example.com
    secretName: myingress-cert # < cert-manager will store the created certificate in this secret.
  rules:
  - host: example.com
    http:
      paths:
      - pathType: Prefix
        path: /
        backend:
          service:
            name: myservice
            port:
              number: 80
```

## Verifying the cert-manager Installation

<https://cert-manager.io/docs/installation/verify/>

```bash
> kubectl apply -f ../cert-manager/test/test-resources.yaml
namespace/cert-manager-test created
issuer.cert-manager.io/test-selfsigned created
certificate.cert-manager.io/selfsigned-cert created

> kubectl describe certificate -n cert-manager-test
Name:         selfsigned-cert
Namespace:    cert-manager-test
Labels:       <none>
Annotations:  <none>
API Version:  cert-manager.io/v1
Kind:         Certificate
Metadata:
  Creation Timestamp:  2023-08-06T22:10:14Z
  Generation:          1
  Managed Fields:
    API Version:  cert-manager.io/v1
    Fields Type:  FieldsV1
    fieldsV1:
      f:status:
        f:revision:
    Manager:      cert-manager-certificates-issuing
    Operation:    Update
    Subresource:  status
    Time:         2023-08-06T22:10:14Z
    API Version:  cert-manager.io/v1
    Fields Type:  FieldsV1
    fieldsV1:
      f:status:
        .:
        f:conditions:
          .:
          k:{"type":"Ready"}:
            .:
            f:lastTransitionTime:
            f:message:
            f:observedGeneration:
            f:reason:
            f:status:
            f:type:
        f:notAfter:
        f:notBefore:
        f:renewalTime:
    Manager:      cert-manager-certificates-readiness
    Operation:    Update
    Subresource:  status
    Time:         2023-08-06T22:10:14Z
    API Version:  cert-manager.io/v1
    Fields Type:  FieldsV1
    fieldsV1:
      f:metadata:
        f:annotations:
          .:
          f:kubectl.kubernetes.io/last-applied-configuration:
      f:spec:
        .:
        f:dnsNames:
        f:issuerRef:
          .:
          f:name:
        f:secretName:
    Manager:         kubectl-client-side-apply
    Operation:       Update
    Time:            2023-08-06T22:10:14Z
  Resource Version:  1868280
  UID:               28c9914b-d7b2-4cb2-b0b5-063c80a5e3f7
Spec:
  Dns Names:
    example.com
  Issuer Ref:
    Name:       test-selfsigned
  Secret Name:  selfsigned-cert-tls
Status:
  Conditions:
    Last Transition Time:  2023-08-06T22:10:14Z
    Message:               Certificate is up to date and has not expired
    Observed Generation:   1
    Reason:                Ready
    Status:                True
    Type:                  Ready
  Not After:               2023-11-04T22:10:14Z
  Not Before:              2023-08-06T22:10:14Z
  Renewal Time:            2023-10-05T22:10:14Z
  Revision:                1
Events:
  Type    Reason     Age   From                                       Message
  ----    ------     ----  ----                                       -------
  Normal  Issuing    63s   cert-manager-certificates-trigger          Issuing certificate as Secret does not exist
  Normal  Generated  63s   cert-manager-certificates-key-manager      Stored new private key in temporary Secret resource "selfsigned-cert-t46s6"
  Normal  Requested  63s   cert-manager-certificates-request-manager  Created new CertificateRequest resource "selfsigned-cert-xs6dg"
  Normal  Issuing    63s   cert-manager-certificates-issuing          The certificate has been successfully issued


> kubectl delete -f ../cert-manager/test/test-resources.yaml

> kubectl describe certificate -n cert-manager-test         
No resources found in cert-manager-test namespace.
```

## Uninstall cert-manager

More: <https://cert-manager.io/docs/installation/kubectl/#uninstalling>

It is recommended that you delete all these resources before uninstalling cert-manager. If you plan on reinstalling later and don't want to lose some custom resources, you can keep them. However, this can potentially lead to problems with finalizers. Some resources, like Challenges, should be deleted to avoid getting stuck in a pending state.

```bash

(base) jim@jMac[...]# kubectl get certificateRequest -o wide --all-namespaces
# Get status of outstanding certificate requests
NAMESPACE   NAME                            APPROVED   DENIED   READY   ISSUER                REQUESTOR                                         STATUS                                                                                                  AGE
default     tls-whoami-ingress-http-rv9zk   True                False   letsencrypt-staging   system:serviceaccount:cert-manager:cert-manager   Waiting on certificate issuance from order default/tls-whoami-ingress-http-rv9zk-374588676: "pending"   4m33s

kubectl get challenges -o wide --all-namespaces                         
NAMESPACE   NAME                                                 STATE     DOMAIN                      REASON                                                                                                                                                                                                                                                                                                                                                                                     AGE
default     tls-whoami-ingress-http-rv9zk-374588676-4211042116   pending   whoami.nerdsbythehour.com   Waiting for HTTP-01 challenge propagation: failed to perform self check GET request 'http://whoami.nerdsbythehour.com/.well-known/acme-challenge/p2dpqOmZyj7l3Xw37lKyOOtP7Kn-Yc0q2QbdEDrilcM': Get "http://whoami.nerdsbythehour.com/.well-known/acme-challenge/p2dpqOmZyj7l3Xw37lKyOOtP7Kn-Yc0q2QbdEDrilcM": dial tcp: lookup whoami.nerdsbythehour.com on 172.17.0.10:53: no such host   31m


# Show all cert-manager
NAMESPACE   NAME                            APPROVED   DENIED   READY   ISSUER                REQUESTOR                                         STATUS                                                                                                  AGE
default     tls-whoami-ingress-http-rv9zk   True                False   letsencrypt-staging   system:serviceaccount:cert-manager:cert-manager   Waiting on certificate issuance from order default/tls-whoami-ingress-http-rv9zk-374588676: "pending"   27m
(base) jim@jMac[...]# kubectl get Issuers,ClusterIssuers,Certificates,CertificateRequests,Orders,Challenges --all-namespaces
NAMESPACE   NAME                                                   READY   AGE
            clusterissuer.cert-manager.io/letsencrypt-staging      True    12h
            clusterissuer.cert-manager.io/letsencrypt-production   True    12h

NAMESPACE   NAME                                                  READY   SECRET                    AGE
default     certificate.cert-manager.io/tls-whoami-ingress-http   False   tls-whoami-ingress-http   50m

NAMESPACE   NAME                                                               APPROVED   DENIED   READY   ISSUER                REQUESTOR                                         AGE
default     certificaterequest.cert-manager.io/tls-whoami-ingress-http-rv9zk   True                False   letsencrypt-staging   system:serviceaccount:cert-manager:cert-manager   27m

NAMESPACE   NAME                                                                 STATE     AGE
default     order.acme.cert-manager.io/tls-whoami-ingress-http-rv9zk-374588676   pending   27m

NAMESPACE   NAME                                                                                STATE     DOMAIN                      AGE
default     challenge.acme.cert-manager.io/tls-whoami-ingress-http-rv9zk-374588676-4211042116   pending   whoami.nerdsbythehour.com   27m

(base) jim@instance-1:~[..]# openssl s_client -connect whoami.nerdsbythehour.com:443 # From a vm in cloud
CONNECTED(00000003)
depth=2 C = US, O = (STAGING) Internet Security Research Group, CN = (STAGING) Pretend Pear X1
verify error:num=20:unable to get local issuer certificate
verify return:1
depth=1 C = US, O = (STAGING) Let's Encrypt, CN = (STAGING) Artificial Apricot R3
verify return:1
depth=0 CN = whoami.nerdsbythehour.com
verify return:1
---
Certificate chain
 0 s:CN = whoami.nerdsbythehour.com
   i:C = US, O = (STAGING) Let's Encrypt, CN = (STAGING) Artificial Apricot R3
 1 s:C = US, O = (STAGING) Let's Encrypt, CN = (STAGING) Artificial Apricot R3
   i:C = US, O = (STAGING) Internet Security Research Group, CN = (STAGING) Pretend Pear X1
 2 s:C = US, O = (STAGING) Internet Security Research Group, CN = (STAGING) Pretend Pear X1
   i:C = US, O = (STAGING) Internet Security Research Group, CN = (STAGING) Doctored Durian Root CA X3
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIFLjCCBBagAwIBAgITAPq9httfm5OnIs0b5OB9T8iM7DANBgkqhkiG9w0BAQsF
ADBZMQswCQYDVQQGEwJVUzEgMB4GA1UEChMXKFNUQUdJTkcpIExldCdzIEVuY3J5
cHQxKDAmBgNVBAMTHyhTVEFHSU5HKSBBcnRpZmljaWFsIEFwcmljb3QgUjMwHhcN
MjMwODA3MDkwOTE5WhcNMjMxMTA1MDkwOTE4WjAkMSIwIAYDVQQDExl3aG9hbWku
bmVyZHNieXRoZWhvdXIuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKC
AQEAuOZ/rE6PoQus9xOpZ+eJIEHgKUTJYxKzotz1APR8Th+clttQYW94NalRG6nQ
Kiz9m6t0XWH4hdqSgOa7yOaB9HHb8lHPYaRlBpexOPchKodkT0WifKil3u6e+FNs
Eo+Mc/M9+LOjxoI8omK5jewShplLnE1IHjMmcszsiWQ4im5HAxcPj+wNoeQiO6Gd
XweRwKbcX1rswtTTC09cuvBTPpQSpTU9Wb2bBL6d2/24bg/tc3rfeGq3IPXnDh70
c6G4PaynBHuw1rmRCmIJT32KmiVLNYbornmx85qo2JnFa33PtnEl5AvJurNBxMsX
vmjLjPw9Vm1ta40ouwz0fYkQcQIDAQABo4ICIjCCAh4wDgYDVR0PAQH/BAQDAgWg
MB0GA1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjAMBgNVHRMBAf8EAjAAMB0G
A1UdDgQWBBReBHFCbd6kNiXi1GeUTs6Qmo5yCzAfBgNVHSMEGDAWgBTecnpI3zHD
plDfn4Uj31c3S10uZTBdBggrBgEFBQcBAQRRME8wJQYIKwYBBQUHMAGGGWh0dHA6
Ly9zdGctcjMuby5sZW5jci5vcmcwJgYIKwYBBQUHMAKGGmh0dHA6Ly9zdGctcjMu
aS5sZW5jci5vcmcvMCQGA1UdEQQdMBuCGXdob2FtaS5uZXJkc2J5dGhlaG91ci5j
b20wEwYDVR0gBAwwCjAIBgZngQwBAgEwggEDBgorBgEEAdZ5AgQCBIH0BIHxAO8A
dgCwzIPlpfl9a698CcwoSQSHKsfoixMsY1C3xv0m4WxsdwAAAYnPePyRAAAEAwBH
MEUCIDF5xazKfaqZYM4hM2EYNZen3XbBjfAty9xlQlgJvn2rAiEA8q6SW1gJwRwm
pYaHNKyw8/AZYTh31EDCjjnH5M3lwJoAdQDtq50d3YNzlZ/1Kojka7S8w8TMTXaK
YMz/TjYtf7jWaAAAAYnPeP6IAAAEAwBGMEQCID0bYtmfoQH0tLK+r2i3HoPTmX1t
gMp/cfrlgPpyBy4AAiBQTuIAVPrfylMvuAzENAfhI+PwXMG80LzWXh2V79wZVTAN
BgkqhkiG9w0BAQsFAAOCAQEAQdpBK1xL2l5qrHRX/oV42jw+5zfN9/jyoU2HN9oI
z6rj0t9D8+z0Upi1IxKkAHiEDxJguTglvEj5qRFrX2cukulYY7up5SBaaBun41f1
EauUwdfVxb4rZRwx0PfMNXAzC06OsbNnoUolu/Bjp82BbrSS4fxqLZhT1fg2s4F7
8kcZL8eD1J6geVlRKUkBMrMboymBtS7a9Ej6i/oKHDxyy3PBKDCnkaz/VNH/Nzb2
MTEvMyec6jy9DR+Iv+1Od8J7wCKwb9h0EH8DoDSYoo2sCaIV+ugA0mkFuO1pCu4h
N+isTSCoBR+eCvvWKMEjSpYJ1FfubH9B9oCWgApYS+q4vw==
-----END CERTIFICATE-----
subject=CN = whoami.nerdsbythehour.com

issuer=C = US, O = (STAGING) Let's Encrypt, CN = (STAGING) Artificial Apricot R3

---
No client certificate CA names sent
Peer signing digest: SHA256
Peer signature type: RSA-PSS
Server Temp Key: X25519, 253 bits
---
SSL handshake has read 4623 bytes and written 381 bytes
Verification error: unable to get local issuer certificate
---
New, TLSv1.3, Cipher is TLS_AES_128_GCM_SHA256
Server public key is 2048 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 20 (unable to get local issuer certificate)
---
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_128_GCM_SHA256
    Session-ID: 6CEFFEEE98D7F8E8157457B9B85C00E6EB3AFAC0C1C6BCE7F7287B035E471AFF
    Session-ID-ctx: 
    Resumption PSK: B8703470778B6D3FA522EC729C7ED67548ACF2B384C1B541A880BC5198E70801
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 604800 (seconds)
    TLS session ticket:
    0000 - ed 66 88 e1 82 f1 5d c1-25 cf 0d d6 ad 89 d7 c9   .f....].%.......
    0010 - 73 cc 26 78 37 e7 c4 d4-58 f9 d4 f0 f9 29 52 ce   s.&x7...X....)R.
    0020 - d0 77 4a da 36 27 a7 1f-3c 29 9d c7 18 2b 84 75   .wJ.6'..<)...+.u
    0030 - 08 92 27 e6 84 84 d1 f8-4b f6 69 b1 d0 09 6e b9   ..'.....K.i...n.
    0040 - 74 d3 43 33 a7 2a da 68-e3 5f 91 90 97 78 26 09   t.C3.*.h._...x&.
    0050 - 49 ce b6 31 20 5a 9d 06-31 cd 80 6d dc c8 ef a6   I..1 Z..1..m....
    0060 - 0f 42 2c d1 70 2c 1e e1-3e 38 e0 47 5d 5a 5e 84   .B,.p,..>8.G]Z^.
    0070 - d8                                                .

    Start Time: 1691403614
    Timeout   : 7200 (sec)
    Verify return code: 20 (unable to get local issuer certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK

HTTP/1.1 400 Bad Request
Content-Type: text/plain; charset=utf-8
Connection: close

(base) jim@jMac[..]# kubectl get certificateRequest -o yaml                 
apiVersion: v1
items:
- apiVersion: cert-manager.io/v1
  kind: CertificateRequest
  metadata:
    annotations:
      cert-manager.io/certificate-name: tls-whoami-ingress-http
      cert-manager.io/certificate-revision: "1"
      cert-manager.io/private-key-secret-name: tls-whoami-ingress-http-2gxm4
    creationTimestamp: "2023-08-07T09:32:52Z"
    generateName: tls-whoami-ingress-http-
    generation: 1
    name: tls-whoami-ingress-http-rv9zk
    namespace: default
    ownerReferences:
    - apiVersion: cert-manager.io/v1
      blockOwnerDeletion: true
      controller: true
      kind: Certificate
      name: tls-whoami-ingress-http
      uid: 8fc896b8-e0e6-41d1-9683-6a5496d2a8a4
    resourceVersion: "1918044"
    uid: 3fa16920-dfec-4b8d-9246-25ac30feba18
  spec:
    extra:
      authentication.kubernetes.io/pod-name:
      - cert-manager-8576cf7d8d-8sz5r
      authentication.kubernetes.io/pod-uid:
      - afd6e5cb-e082-44ab-8af3-cf6ef7d51302
    groups:
    - system:serviceaccounts
    - system:serviceaccounts:cert-manager
    - system:authenticated
    issuerRef:
      group: cert-manager.io
      kind: ClusterIssuer
      name: letsencrypt-staging
    request: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0KTUlJQ2lUQ0NBWEVDQVFBd0FEQ0NBU0l3RFFZSktvWklodmNOQVFFQkJRQURnZ0VQQURDQ0FRb0NnZ0VCQUxqbQpmNnhPajZFTHJQY1RxV2ZuaVNCQjRDbEV5V01TczZMYzlRRDBmRTRmbkpiYlVHRnZlRFdwVVJ1cDBDb3MvWnVyCmRGMWgrSVhha29EbXU4am1nZlJ4Mi9KUnoyR2taUWFYc1RqM0lTcUhaRTlGb255b3BkN3VudmhUYkJLUGpIUHoKUGZpem84YUNQS0ppdVkzc0VvYVpTNXhOU0I0ekpuTE03SWxrT0lwdVJ3TVhENC9zRGFIa0lqdWhuVjhIa2NDbQozRjlhN01MVTB3dFBYTHJ3VXo2VUVxVTFQVm05bXdTK25kdjl1RzRQN1hONjMzaHF0eUQxNXc0ZTlIT2h1RDJzCnB3UjdzTmE1a1FwaUNVOTlpcG9sU3pXRzZLNTVzZk9hcU5pWnhXdDl6N1p4SmVRTHlicXpRY1RMRjc1b3k0ejgKUFZadGJXdU5LTHNNOUgySkVIRUNBd0VBQWFCRU1FSUdDU3FHU0liM0RRRUpEakUxTURNd0pBWURWUjBSQkIwdwpHNElaZDJodllXMXBMbTVsY21SellubDBhR1ZvYjNWeUxtTnZiVEFMQmdOVkhROEVCQU1DQmFBd0RRWUpLb1pJCmh2Y05BUUVMQlFBRGdnRUJBQzVXV3pXSUh1NDZXSW9jZDVseStGUlMwWmhWRk1sQUx6NUxmcXd4aGxpMTdtbVMKQlc5NUVYNmxDbFlyTVBBYXBVQTNXU0ZvTFJtVlM4MzZGTlJ6Z3NkWW5Mcmc4eFRwc0x2SnVpN0ovZ05HU2YrTgpwRkgzU2hhYUxneGJWR2ZNaGYxU0NNeFdLK0YvaFlFQWJDWkNCS1BHemd1dmtQR2hGWjFRNUR0OEhiS3RRZDhPCjZKd1FKRDdYQnZQRzZBazcra29wRnpoamJpYUVnTy8zZlJPN3lYSzJIM1VpNENHN2VEUUFGWVRpbVZSK0FCMzMKQUtwR08zaFJ3eGgySUtobTI4L0xWVFlrTnpOR0h5QUd5TGRoWk1MMlFiZG43YXdQSXU3UVVxWHkwelNxcUV6Zwo1SXljZ3F5NC9KcTAvS3RYZTE5TFFuRC9FbjRieHJsL0NyYWwxT2s9Ci0tLS0tRU5EIENFUlRJRklDQVRFIFJFUVVFU1QtLS0tLQo=
    uid: 1e6cc722-b7e0-49a1-9079-0b7b741e186d
    usages:
    - digital signature
    - key encipherment
    username: system:serviceaccount:cert-manager:cert-manager
  status:
    certificate: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZMakNDQkJhZ0F3SUJBZ0lUQVBxOWh0dGZtNU9uSXMwYjVPQjlUOGlNN0RBTkJna3Foa2lHOXcwQkFRc0YKQURCWk1Rc3dDUVlEVlFRR0V3SlZVekVnTUI0R0ExVUVDaE1YS0ZOVVFVZEpUa2NwSUV4bGRDZHpJRVZ1WTNKNQpjSFF4S0RBbUJnTlZCQU1USHloVFZFRkhTVTVIS1NCQmNuUnBabWxqYVdGc0lFRndjbWxqYjNRZ1VqTXdIaGNOCk1qTXdPREEzTURrd09URTVXaGNOTWpNeE1UQTFNRGt3T1RFNFdqQWtNU0l3SUFZRFZRUURFeGwzYUc5aGJXa3UKYm1WeVpITmllWFJvWldodmRYSXVZMjl0TUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQwpBUUVBdU9aL3JFNlBvUXVzOXhPcForZUpJRUhnS1VUSll4S3pvdHoxQVBSOFRoK2NsdHRRWVc5NE5hbFJHNm5RCktpejltNnQwWFdINGhkcVNnT2E3eU9hQjlISGI4bEhQWWFSbEJwZXhPUGNoS29ka1QwV2lmS2lsM3U2ZStGTnMKRW8rTWMvTTkrTE9qeG9JOG9tSzVqZXdTaHBsTG5FMUlIak1tY3N6c2lXUTRpbTVIQXhjUGord05vZVFpTzZHZApYd2VSd0tiY1gxcnN3dFRUQzA5Y3V2QlRQcFFTcFRVOVdiMmJCTDZkMi8yNGJnL3RjM3JmZUdxM0lQWG5EaDcwCmM2RzRQYXluQkh1dzFybVJDbUlKVDMyS21pVkxOWWJvcm5teDg1cW8ySm5GYTMzUHRuRWw1QXZKdXJOQnhNc1gKdm1qTGpQdzlWbTF0YTQwb3V3ejBmWWtRY1FJREFRQUJvNElDSWpDQ0FoNHdEZ1lEVlIwUEFRSC9CQVFEQWdXZwpNQjBHQTFVZEpRUVdNQlFHQ0NzR0FRVUZCd01CQmdnckJnRUZCUWNEQWpBTUJnTlZIUk1CQWY4RUFqQUFNQjBHCkExVWREZ1FXQkJSZUJIRkNiZDZrTmlYaTFHZVVUczZRbW81eUN6QWZCZ05WSFNNRUdEQVdnQlRlY25wSTN6SEQKcGxEZm40VWozMWMzUzEwdVpUQmRCZ2dyQmdFRkJRY0JBUVJSTUU4d0pRWUlLd1lCQlFVSE1BR0dHV2gwZEhBNgpMeTl6ZEdjdGNqTXVieTVzWlc1amNpNXZjbWN3SmdZSUt3WUJCUVVITUFLR0dtaDBkSEE2THk5emRHY3Rjak11CmFTNXNaVzVqY2k1dmNtY3ZNQ1FHQTFVZEVRUWRNQnVDR1hkb2IyRnRhUzV1WlhKa2MySjVkR2hsYUc5MWNpNWoKYjIwd0V3WURWUjBnQkF3d0NqQUlCZ1puZ1F3QkFnRXdnZ0VEQmdvckJnRUVBZFo1QWdRQ0JJSDBCSUh4QU84QQpkZ0N3eklQbHBmbDlhNjk4Q2N3b1NRU0hLc2ZvaXhNc1kxQzN4djBtNFd4c2R3QUFBWW5QZVB5UkFBQUVBd0JICk1FVUNJREY1eGF6S2ZhcVpZTTRoTTJFWU5aZW4zWGJCamZBdHk5eGxRbGdKdm4yckFpRUE4cTZTVzFnSndSd20KcFlhSE5LeXc4L0FaWVRoMzFFRENqam5INU0zbHdKb0FkUUR0cTUwZDNZTnpsWi8xS29qa2E3Uzh3OFRNVFhhSwpZTXovVGpZdGY3aldhQUFBQVluUGVQNklBQUFFQXdCR01FUUNJRDBiWXRtZm9RSDB0TEsrcjJpM0hvUFRtWDF0CmdNcC9jZnJsZ1BweUJ5NEFBaUJRVHVJQVZQcmZ5bE12dUF6RU5BZmhJK1B3WE1HODBMeldYaDJWNzl3WlZUQU4KQmdrcWhraUc5dzBCQVFzRkFBT0NBUUVBUWRwQksxeEwybDVxckhSWC9vVjQyancrNXpmTjkvanlvVTJITjlvSQp6NnJqMHQ5RDgrejBVcGkxSXhLa0FIaUVEeEpndVRnbHZFajVxUkZyWDJjdWt1bFlZN3VwNVNCYWFCdW40MWYxCkVhdVV3ZGZWeGI0clpSd3gwUGZNTlhBekMwNk9zYk5ub1VvbHUvQmpwODJCYnJTUzRmeHFMWmhUMWZnMnM0RjcKOGtjWkw4ZUQxSjZnZVZsUktVa0JNck1ib3ltQnRTN2E5RWo2aS9vS0hEeHl5M1BCS0RDbmthei9WTkgvTnpiMgpNVEV2TXllYzZqeTlEUitJdisxT2Q4Sjd3Q0t3YjloMEVIOERvRFNZb28yc0NhSVYrdWdBMG1rRnVPMXBDdTRoCk4raXNUU0NvQlIrZUN2dldLTUVqU3BZSjFGZnViSDlCOW9DV2dBcFlTK3E0dnc9PQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCi0tLS0tQkVHSU4gQ0VSVElGSUNBVEUtLS0tLQpNSUlGV3pDQ0EwT2dBd0lCQWdJUVRmUXJsZEh1bXpwTUxyTTdqUkJkMWpBTkJna3Foa2lHOXcwQkFRc0ZBREJtCk1Rc3dDUVlEVlFRR0V3SlZVekV6TURFR0ExVUVDaE1xS0ZOVVFVZEpUa2NwSUVsdWRHVnlibVYwSUZObFkzVnkKYVhSNUlGSmxjMlZoY21Ob0lFZHliM1Z3TVNJd0lBWURWUVFERXhrb1UxUkJSMGxPUnlrZ1VISmxkR1Z1WkNCUQpaV0Z5SUZneE1CNFhEVEl3TURrd05EQXdNREF3TUZvWERUSTFNRGt4TlRFMk1EQXdNRm93V1RFTE1Ba0dBMVVFCkJoTUNWVk14SURBZUJnTlZCQW9URnloVFZFRkhTVTVIS1NCTVpYUW5jeUJGYm1OeWVYQjBNU2d3SmdZRFZRUUQKRXg4b1UxUkJSMGxPUnlrZ1FYSjBhV1pwWTJsaGJDQkJjSEpwWTI5MElGSXpNSUlCSWpBTkJna3Foa2lHOXcwQgpBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUF1NlRSOCs3NGI0Nm1PRTFGVXdCcnZ4ekVZTGNrM2lhc21LcmNRa2IrCmd5L3o5Snk3UU5JQWwwQjlwVktwNFlVNzZKd3hGNURPWlpoaTd2SzdTYkNrSzZGYkhseVU1QmlEWUl4YmJmdk8KTC9qVkdxZHNTak5hSlFUZzNDM1hySmphL0hBNFdDRkVNVm9UMndEWm04QUJDMU4rSVFlN1E2RkVxYzhOd21UUwpubW1SUW00VFF2cjA2RFAremdGSy9NTnVieFdXRFNiU0tLVEg1aW01ajJmWmZnK2ovdE0xYkdhY3pGV3c4L2xTCm51a3luNUoyTCtOSlluY2x6a1hvaDluTUZueVBtVmJmeURQT2M0WTI1YVR6Vm9lQktYYS9jWjVNTStXZGRqZEwKYmlXdm0xOWYxc1luMWFSYUFJcmtwcHY3a2tuODN2Y3RoOFhDRzM5cUMyWnZhUUlEQVFBQm80SUJFRENDQVF3dwpEZ1lEVlIwUEFRSC9CQVFEQWdHR01CMEdBMVVkSlFRV01CUUdDQ3NHQVFVRkJ3TUNCZ2dyQmdFRkJRY0RBVEFTCkJnTlZIUk1CQWY4RUNEQUdBUUgvQWdFQU1CMEdBMVVkRGdRV0JCVGVjbnBJM3pIRHBsRGZuNFVqMzFjM1MxMHUKWlRBZkJnTlZIU01FR0RBV2dCUzE4Mlh5L3JBS2toLzdQSDN6UktDc1l5WERGREEyQmdnckJnRUZCUWNCQVFRcQpNQ2d3SmdZSUt3WUJCUVVITUFLR0dtaDBkSEE2THk5emRHY3RlREV1YVM1c1pXNWpjaTV2Y21jdk1Dc0dBMVVkCkh3UWtNQ0l3SUtBZW9CeUdHbWgwZEhBNkx5OXpkR2N0ZURFdVl5NXNaVzVqY2k1dmNtY3ZNQ0lHQTFVZElBUWIKTUJrd0NBWUdaNEVNQVFJQk1BMEdDeXNHQVFRQmd0OFRBUUVCTUEwR0NTcUdTSWIzRFFFQkN3VUFBNElDQVFDTgpETGFtOXlOMEVGeHhuLzNwK3J1V082bi85Z29DQU01UFQ2Y0M2ZmtqTXM0dWFzNlVHWEpqcjVqN1BvVFFmM0MxCnZ1eGlJR1JKQzZxeFY3eWM2VTBYK3cwTWo4NXNISTVEblFWV041K0QxZXI3bXAxM0pKQTB4YkFiSGEzUmxjem4KeTJRODJYS3VpOFdIdVdyYTBnYjJLTHBmYm9ZajFHaGdraHIzZ2F1ODNwQy9XUThIZmt3Y3ZTd2hJWXFUcXhvWgpVcThISWYzTTgycVM5YUtPWkUwQ0VtU3lSMXpacVF4SlVUN2VtT1VhcGtVTjlwb0o5ekdjK0ZnUlp2ZHJvMFhCCnlwaFdYRGFxTVlwaDBEeFcvMTBpZzVqNHhtbU5EakNSbXFJS3NLb1dBNTJ3QlRLS1hLMW5hMnR5L2xXNWRodEEKeGt6NXJWWkZkNHNnUzRKME8rem02ZDVHUmtXc05KNGtub3RHWGw4dnRTM1g0MEtYZWIzQTUrLzNwMHFhRDIxNQpYcThvU05PUmZCMm9JMWtRdXlFQUo1eHZQVGRmd1JseVJHM2xGWW9kclJnNnBvVUJELzhmTlRYTXR6eWRwUmd5CnpVUVpoLzE4RjZCL2lXNmNiaVJOOXIySGtoMDVPbStxMC82dzBEZFplKzhZck5wZmhTT2JyLzFlVlpiS0dNSVkKcUtteVpiQk51NXlzRU5JSzVNUGMxNG1VZUttRmpwTjg0MFZSNXp1bm9VNTJscXBMRHVhL3FJTThpZGs4NnhHVwp4eDJtbDQzRE8vWWEvdFZaVm9rMG1PMFRVanpKSWZQcXl2cjQ1NUlzSXV0NFJsQ1I5SXEwRURUdmUyL1p3Q3VHCmhTanBUVUZHU2lRclIySksyRXZwK282QUVUVWtCQ08xYXcwUHBRQlBEUT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0KLS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUZWRENDQkR5Z0F3SUJBZ0lSQU8xZFc4bHQrOTlOUHMxcVNZM1JzOGN3RFFZSktvWklodmNOQVFFTEJRQXcKY1RFTE1Ba0dBMVVFQmhNQ1ZWTXhNekF4QmdOVkJBb1RLaWhUVkVGSFNVNUhLU0JKYm5SbGNtNWxkQ0JUWldOMQpjbWwwZVNCU1pYTmxZWEpqYUNCSGNtOTFjREV0TUNzR0ExVUVBeE1rS0ZOVVFVZEpUa2NwSUVSdlkzUnZjbVZrCklFUjFjbWxoYmlCU2IyOTBJRU5CSUZnek1CNFhEVEl4TURFeU1ERTVNVFF3TTFvWERUSTBNRGt6TURFNE1UUXcKTTFvd1pqRUxNQWtHQTFVRUJoTUNWVk14TXpBeEJnTlZCQW9US2loVFZFRkhTVTVIS1NCSmJuUmxjbTVsZENCVApaV04xY21sMGVTQlNaWE5sWVhKamFDQkhjbTkxY0RFaU1DQUdBMVVFQXhNWktGTlVRVWRKVGtjcElGQnlaWFJsCmJtUWdVR1ZoY2lCWU1UQ0NBaUl3RFFZSktvWklodmNOQVFFQkJRQURnZ0lQQURDQ0Fnb0NnZ0lCQUxiYWdFZEQKVGExUWdHQldTWWt5TWhzY1pYRU5PQmFWUlRNWDFoY2VKRU5nc0wwTWE0OUQzTWlsSTRLUzM4bXRrbWRGNmNQVwpuTCsrZmdlaFQwRmJSSFpnak9FcjhVQU40akg2b21qcmJURCsrVlpuZVRzTVZhR2FtUW1EZEZsNWcxZ1lhaWdrCmtteDhPaUNPNjhhNFFYZzR3U3luNmlEaXBLUDh1dHNFK3gxRTI4U0E3NUhPWXFwZHJrNEhHeHVVTHZscjAzd1oKR1RJZi9vUnQyL2MrZFltRG9hSmhnZStHT3JMQUVRQnlPNys4K3Z6T3dwTkFQRXg2TFcrY3JFRVo3ZUJYaWg2VgpQMTlzVEd5M3lmcUs1dFB0VGRYWENPUU1LQXArZ0NqL1ZCeWhtSXIrMGlOREM1NDBndHZWMzAzV3BjYndua2tMCllDMEZ0MmNZVXlIdGtzdE9mUmNSTytLMmNab3pvU3dWUHlCOC9KOVJwY1JLM2pnblg5bHVqZndBL3BBYlAwSjIKVVBRRnhtV0ZSUW5GamFxNnJrcWJORUJnTHkra0ZMMU5Fc1JidkZiS3JSaTViWXkybE5tczJOSlBadmROUWJULwoyZEJaS21KcXhIa3hDdU9RRmpoSlFOZU8rTmptMVoxaUFUUy8zcnRzMnlabHFYS3N4UVV6TjZ2TmJEOEtuWFJNCkVlT1hVWXZiVjRscWZDZjhtUzE0V0ViU2lNeTg3R0I1Uzl1Y1NWMVhVcmxURzVVR2NNU1pPQmNFVXBpc1JQRW0KUVdVT1RXSW9EUTVGT2lhL0dJK0tpNTIzcjJydUVtYm1HMzdFQlNCWGR4SWRuZHFyankrUVZBbUNlYnlEeDllVgpFR09JcG4yNmJXNUxLZXJ1bUp4YS9DRkJhS2k0YlJ2bWRKUkxBZ01CQUFHamdmRXdnZTR3RGdZRFZSMFBBUUgvCkJBUURBZ0VHTUE4R0ExVWRFd0VCL3dRRk1BTUJBZjh3SFFZRFZSME9CQllFRkxYelpmTCtzQXFTSC9zOGZmTkUKb0t4akpjTVVNQjhHQTFVZEl3UVlNQmFBRkFoWDJvbkhvbE41REUvZDRKQ1BkTHJpSjNORU1EZ0dDQ3NHQVFVRgpCd0VCQkN3d0tqQW9CZ2dyQmdFRkJRY3dBb1ljYUhSMGNEb3ZMM04wWnkxa2MzUXpMbWt1YkdWdVkzSXViM0puCkx6QXRCZ05WSFI4RUpqQWtNQ0tnSUtBZWhoeG9kSFJ3T2k4dmMzUm5MV1J6ZERNdVl5NXNaVzVqY2k1dmNtY3YKTUNJR0ExVWRJQVFiTUJrd0NBWUdaNEVNQVFJQk1BMEdDeXNHQVFRQmd0OFRBUUVCTUEwR0NTcUdTSWIzRFFFQgpDd1VBQTRJQkFRQjd0UjhCMGVJUVNTNk1oUDVrdXZHdGgrZE4wMkRzSWhyMHlKdGsyZWhJY1BJcVN4UlJtSEdsCjR1MmMzUWx2RXBlUkRwMnc3ZVFkUlRsSS9Xbk5oWTRKT29mcE1mMnp3QUJnQld0QXUwVm9vUWNaWlRwUXJ1aWcKRi96NnhZa0JrM1VIa2plcXh6TU4zZDFFcUd1c3hKb3FnZFRvdVo1WDVRVFRJZWU5blEzTEVoV25SU1hEeDdZMAp0dFIxQkdmY2RxSG9wTzRJQnFBaGJrS1JqRjV6ajdPRDhjRzM1b215d1ViWnRPSm5mdGlJMG5GY1JheGJYbzB2Cm9EZkxEMFM2K0FDMlIzdEtwcWprTlg2LzkxaHJSRmdsVWFreU1jWlUveGxlcWJ2NitMcjNZRDhQc0JUdWI2bEkKb1oybFMzOGZMMThBb240NThmYmMwQlBIdGVuZmhLajUKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=
    conditions:
    - lastTransitionTime: "2023-08-07T09:32:52Z"
      message: Certificate request has been approved by cert-manager.io
      reason: cert-manager.io
      status: "True"
      type: Approved
    - lastTransitionTime: "2023-08-07T10:09:23Z"
      message: Certificate fetched from issuer successfully
      reason: Issued
      status: "True"
      type: Ready
kind: List
metadata:
  resourceVersion: ""
```
