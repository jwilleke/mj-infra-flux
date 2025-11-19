# Authentik Configuration for Home Assistant

This guide walks you through configuring Authentik to work with Home Assistant.

## Status

✅ **Technical Setup Complete**
- Traefik ingress configured with ForwardAuth middleware
- External service proxy configured (192.168.68.20:8123)
- Let's Encrypt certificate issued

⏳ **Authentik Configuration Required**
- Create Proxy Provider application in Authentik
- Configure Home Assistant trusted proxies

## Step 1: Create Authentik Proxy Provider

1. **Log into Authentik**
   - URL: https://auth.nerdsbythehour.com
   - Login as administrator

2. **Navigate to Applications**
   - Click **Applications** in the sidebar
   - Then click **Applications** again

3. **Create Application with Provider**
   - Click **Create with Provider** button
   - Select **Proxy** as the provider type

4. **Configure Provider Settings**

   **Basic Settings:**
   - **Name:** `Home Assistant`
   - **Slug:** `homeassistant` (auto-generated)
   - **Group:** Leave empty or create "Smart Home" group

   **Provider Settings:**
   - **Type:** `Proxy`
   - **Authorization flow:** Select your default authorization flow (usually `default-provider-authorization-implicit-consent`)
   - **External host:** `https://ha.nerdsbythehour.com`
   - **Internal host:** `https://192.168.68.20:8123`
   - **Internal host SSL validation:** ❌ **Unchecked** (Home Assistant uses self-signed cert)
   - **Forward auth (domain level):** ✅ **Checked**

   **Advanced Settings (leave as defaults):**
   - Token validity: `hours=24`
   - Mode: `Forward single application`

5. **Configure Application**
   - **UI Settings (optional):**
     - Icon: Upload or use URL (e.g., Home Assistant logo)
     - Description: "Smart home automation and IoT device control"

   - **Policy / Group / User Bindings:**
     - Add users or groups that should have access
     - Click **Create binding** to add authorized users

6. **Create the Application**
   - Click **Create** button at the bottom
   - Verify it appears in the Applications list

## Step 2: Configure Home Assistant

Home Assistant needs to trust the reverse proxy headers from Traefik/Authentik.

### Edit configuration.yaml

1. **SSH to Home Assistant host:**
   ```bash
   ssh 192.168.68.20
   # or access the Home Assistant terminal
   ```

2. **Edit `/homeassistant/configuration.yaml`:**
   ```yaml
   http:
     use_x_forwarded_for: true
     trusted_proxies:
       - 10.42.0.0/16   # k3s pod network
       - 10.43.0.0/16   # k3s service network
       - 192.168.68.71  # k3s host (deby)
   ```

3. **Restart Home Assistant:**
   - In Home Assistant UI: Settings → System → Restart
   - Or via command line: `ha core restart`

## Step 3: Test Access

1. **Open browser in private/incognito mode**
   - Navigate to: https://ha.nerdsbythehour.com

2. **Expected Flow:**
   - You should be redirected to Authentik login
   - After successful login, you'll be redirected to Home Assistant
   - Home Assistant may still require its own login (see below)

3. **Troubleshooting:**
   - **404 "Not Found" from Authentik:** Application not created yet (go back to Step 1)
   - **502 Bad Gateway:** Home Assistant not running or not accessible from k3s host
   - **400 Bad Request from Home Assistant:** `trusted_proxies` not configured (go back to Step 2)
   - **Certificate error:** Wait a few minutes for Let's Encrypt cert to be issued

## Optional: Single Sign-On (SSO) Integration

By default, Home Assistant still requires its own authentication after passing through Authentik. To enable true SSO:

### Option A: Use hass-auth-header Component (Recommended)

1. **Install the custom component:**
   - Add via HACS or manually install `hass-auth-header`
   - Reference: https://github.com/BeryJu/hass-auth-header

2. **Configure in Home Assistant:**
   ```yaml
   # configuration.yaml
   auth_header:
     username_header: X-authentik-username
   ```

3. **User Matching:**
   - Home Assistant usernames must match Authentik usernames
   - Users will automatically login if username matches
   - Users still need to exist in Home Assistant first

### Option B: Use Trusted Networks (Less Secure)

Configure Home Assistant to trust all requests from the k3s network:

```yaml
# configuration.yaml
homeassistant:
  auth_providers:
    - type: trusted_networks
      trusted_networks:
        - 10.42.0.0/16
        - 10.43.0.0/16
        - 192.168.68.71/32
      allow_bypass_login: true
```

**⚠️ Warning:** This bypasses Home Assistant authentication entirely. Only use if you trust the network.

## Verification

### Check Authentik Headers

From the k3s host, verify Authentik is passing headers:

```bash
curl -I -k https://ha.nerdsbythehour.com
```

You should see headers like:
```
x-authentik-id: <uuid>
x-powered-by: authentik
```

### Check Certificate

```bash
sudo kubectl get certificate -n home-assistant-proxy
```

Should show:
```
NAME                  READY   SECRET               AGE
home-assistant-cert   True    home-assistant-tls   1d
```

### Check Ingress

```bash
sudo kubectl get ingress -n home-assistant-proxy
```

Should show:
```
NAME             CLASS     HOSTS                   ADDRESS         PORTS
home-assistant   traefik   ha.nerdsbythehour.com   192.168.68.71   80, 443
```

## Architecture

```
User Browser
    ↓ HTTPS
ha.nerdsbythehour.com (Traefik)
    ↓
Authentik ForwardAuth Middleware
    ↓ (authenticated)
Traefik → home-assistant-external Service
    ↓ HTTPS (insecure, self-signed)
192.168.68.20:8123 (Home Assistant)
```

## Security Notes

- ✅ External access protected by Authentik SSO
- ✅ Let's Encrypt certificate for ha.nerdsbythehour.com
- ✅ Home Assistant validates trusted proxies
- ⚠️ Internal connection to HA uses self-signed cert (acceptable for local network)
- ⚠️ Home Assistant still has its own authentication (unless SSO configured)

## Related Documentation

- Authentik Home Assistant Integration: https://integrations.goauthentik.io/miscellaneous/home-assistant/
- Home Assistant HTTP Integration: https://www.home-assistant.io/integrations/http/
- Traefik ForwardAuth: https://doc.traefik.io/traefik/middlewares/http/forwardauth/
